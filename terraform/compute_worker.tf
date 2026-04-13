# Single VM that runs both the Celery worker and Celery beat scheduler via
# docker-compose. Cloud Run isn't a great fit here: workers are long-lived
# processes that don't serve HTTP, and beat needs a singleton.
#
# Image is pulled from Artifact Registry on boot. To roll the image:
#   gcloud compute instances reset fundraiser-worker --zone=me-west1-b
# (or the deploy.sh script does this automatically.)

locals {
  # COS doesn't ship gcloud, so AR auth uses the preinstalled
  # docker-credential-gcr helper and secrets are fetched directly from the
  # Secret Manager REST API with a metadata-server access token.
  worker_startup_script = <<-EOT
    #!/bin/bash
    set -euo pipefail
    exec > >(tee -a /var/log/startup-script.log) 2>&1

    # Configure Docker to use the GCR credential helper for Artifact Registry.
    # COS has a read-only /root, so point HOME at a writable location for the
    # credential helper's config.json (docker then reads it via $HOME/.docker).
    export HOME=/var/lib/docker-cred
    mkdir -p "$HOME/.docker"
    docker-credential-gcr configure-docker --registries=${var.region}-docker.pkg.dev

    IMAGE="${var.api_image}"
    docker pull "$IMAGE"

    # Pull secrets at boot — refreshed on every restart, so rotating a secret
    # only requires `gcloud compute instances reset`.
    # Tokens endpoint returns compact JSON; Secret Manager returns pretty-
    # printed JSON with whitespace, so both sed patterns tolerate optional
    # whitespace around the colon.
    TOKEN=$(curl -sfH "Metadata-Flavor: Google" \
      http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token \
      | sed -n 's/.*"access_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

    fetch_secret() {
      curl -sfH "Authorization: Bearer $TOKEN" \
        "https://secretmanager.googleapis.com/v1/projects/${var.project_id}/secrets/$1/versions/latest:access" \
        | sed -n 's/.*"data"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
        | base64 -d
    }

    DATABASE_URL=$(fetch_secret fundraiser-worker-database-url)
    CELERY_DATABASE_URL=$(fetch_secret fundraiser-celery-database-url)
    REDIS_URL=$(fetch_secret fundraiser-redis-url)
    ANTHROPIC_API_KEY=$(fetch_secret fundraiser-anthropic-api-key)
    CRUNCHBASE_API_KEY=$(fetch_secret fundraiser-crunchbase-api-key)
    PROXYCURL_API_KEY=$(fetch_secret fundraiser-proxycurl-api-key)
    EXA_API_KEY=$(fetch_secret fundraiser-exa-api-key)
    TAVILY_API_KEY=$(fetch_secret fundraiser-tavily-api-key)
    SLACK_WEBHOOK_URL=$(fetch_secret fundraiser-slack-webhook-url)

    cat > /etc/fundraiser.env <<EOF
DATABASE_URL=$DATABASE_URL
CELERY_DATABASE_URL=$CELERY_DATABASE_URL
REDIS_URL=$REDIS_URL
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
CRUNCHBASE_API_KEY=$CRUNCHBASE_API_KEY
PROXYCURL_API_KEY=$PROXYCURL_API_KEY
EXA_API_KEY=$EXA_API_KEY
TAVILY_API_KEY=$TAVILY_API_KEY
SLACK_WEBHOOK_URL=$SLACK_WEBHOOK_URL
VERTEX_PROJECT=${var.project_id}
EOF
    chmod 600 /etc/fundraiser.env

    docker rm -f fundraiser-worker fundraiser-beat 2>/dev/null || true

    docker run -d --name fundraiser-worker --restart=always \
      --env-file /etc/fundraiser.env \
      "$IMAGE" \
      celery -A app.tasks.worker worker --loglevel=info --concurrency=3

    docker run -d --name fundraiser-beat --restart=always \
      --env-file /etc/fundraiser.env \
      "$IMAGE" \
      celery -A app.tasks.worker beat --loglevel=info
  EOT
}

resource "google_compute_instance" "worker" {
  name         = "fundraiser-worker"
  machine_type = var.worker_machine_type
  zone         = var.zone

  tags = ["allow-iap-ssh"]

  boot_disk {
    initialize_params {
      image = "projects/cos-cloud/global/images/family/cos-stable"
      size  = 20
      type  = "pd-balanced"
    }
  }

  network_interface {
    network    = google_compute_network.main.id
    subnetwork = google_compute_subnetwork.main.id
    # No access_config block → no public IP. Egress goes through Cloud NAT.
  }

  service_account {
    email  = google_service_account.worker.email
    scopes = ["cloud-platform"]
  }

  metadata_startup_script = local.worker_startup_script

  # Re-run startup script when the image tag changes.
  metadata = {
    image-tag = var.api_image
  }

  allow_stopping_for_update = true

  depends_on = [
    google_project_iam_member.worker_roles,
    google_sql_database_instance.primary,
    google_redis_instance.main,
    google_secret_manager_secret_version.worker_database_url,
    google_secret_manager_secret_version.redis_url,
    google_secret_manager_secret_version.app,
  ]
}
