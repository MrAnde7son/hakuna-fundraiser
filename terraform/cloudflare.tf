# Cloudflare DNS for the frontend custom domain.
#
# Auth: the provider reads CLOUDFLARE_API_TOKEN from the environment, so the
# token never lands in tfvars or state. Create one at:
#   https://dash.cloudflare.com/profile/api-tokens
# Required permissions:  Zone -> DNS -> Edit  (scoped to zone "hakunahq.com")
#
# Then before applying:
#   export CLOUDFLARE_API_TOKEN='...'
#   terraform init
#   terraform apply
#
# To opt out of Cloudflare management, set var.cloudflare_zone = "".

provider "cloudflare" {
  # api_token sourced from $CLOUDFLARE_API_TOKEN
}

data "cloudflare_zone" "this" {
  count = var.cloudflare_zone == "" ? 0 : 1
  name  = var.cloudflare_zone
}

# Cloud Run domain mapping — provisions a Google-managed cert for app_domain
# and tells us which DNS records to add (always ghs.googlehosted.com for
# subdomains, but we read it from .status to be exact).
resource "google_cloud_run_domain_mapping" "frontend" {
  name     = var.app_domain
  location = var.region

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.frontend.name
  }
}

resource "cloudflare_record" "frontend" {
  count = var.cloudflare_zone == "" ? 0 : 1

  zone_id = data.cloudflare_zone.this[0].id
  name    = trimsuffix(var.app_domain, ".${var.cloudflare_zone}")
  # Cloud Run returns ghs.googlehosted.com for subdomain mappings.
  value   = google_cloud_run_domain_mapping.frontend.status[0].resource_records[0].rrdata
  type    = google_cloud_run_domain_mapping.frontend.status[0].resource_records[0].type
  ttl     = 1     # 1 = automatic
  proxied = false # MUST be off — Google's managed cert validates by resolving
                  # the domain to ghs.googlehosted.com. Cloudflare proxy hides
                  # that and the cert sits in pending forever.

  comment = "fundraiser frontend Cloud Run (managed by Terraform)"
}
