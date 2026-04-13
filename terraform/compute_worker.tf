# Single VM that runs both the Celery worker and Celery beat scheduler via
# docker-compose. Cloud Run isn't a great fit here: workers are long-lived
# processes that don't serve HTTP, and beat needs a singleton.
#
# Image is pulled from Artifact Registry on boot. To roll the image:
#   gcloud compute instances reset fundraiser-worker --zone=me-west1-b
# (or the deploy.sh script does this automatically.)

locals {
  worker_startup_script = <<-EOT
    #!/bin/bash
    set -euxo pipefail
    exec > >(tee -a /var/log/startup-script.log) 2>&1

    # Install Docker if missing (Container-Optimized OS already has it).
    if ! command -v docker >/dev/null; then
      apt-get update
      apt-get install -y docker.io
    fi

    # Auth to Artifact Registry using the VM's service account.
    gcloud auth configure-docker ${var.region}-docker.pkg.dev --quiet

    IMAGE="${var.api_image}"
    docker pull "$IMAGE"

    # Pull secrets at boot — refreshed on every restart, so rotating a secret
    # only requires `gcloud compute instances reset`.
    DATABASE_URL=$(gcloud secrets versions access latest --secret=fundraiser-worker-database-url)
    CELERY_DATABASE_URL=$(gcloud secrets versions access latest --secret=fundraiser-celery-database-url)
    REDIS_URL=$(gcloud secrets versions access latest --secret=fundraiser-redis-url)
    ANTHROPIC_API_KEY=$(gcloud secrets versions access latest --secret=fundraiser-anthropic-api-key)
    CRUNCHBASE_API_KEY=$(gcloud secrets versions access latest --secret=fundraiser-crunchbase-api-key)
    PROXYCURL_API_KEY=$(gcloud secrets versions access latest --secret=fundraiser-proxycurl-api-key)
    EXA_API_KEY=$(gcloud secrets versions access latest --secret=fundraiser-exa-api-key)
    TAVILY_API_KEY=$(gcloud secrets versions access latest --secret=fundraiser-tavily-api-key)
    SLACK_WEBHOOK_URL=$(gcloud secrets versions access latest --secret=fundraiser-slack-webhook-url)

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
