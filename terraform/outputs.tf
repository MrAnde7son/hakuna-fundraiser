output "api_url" {
  value       = google_cloud_run_v2_service.api.uri
  description = "Cloud Run URL for the FastAPI backend"
}

output "frontend_url" {
  value       = google_cloud_run_v2_service.frontend.uri
  description = "Cloud Run URL for the React frontend (public)"
}

output "artifact_registry_url" {
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}"
  description = "Docker registry URL — prefix for image tags"
}

output "cloud_sql_connection_name" {
  value       = google_sql_database_instance.primary.connection_name
  description = "Used by cloud-sql-proxy: project:region:instance"
}

output "worker_ssh" {
  value       = "gcloud compute ssh fundraiser-worker --zone=${var.zone} --tunnel-through-iap"
  description = "SSH to the worker VM via IAP"
}

output "worker_logs" {
  value       = "gcloud compute ssh fundraiser-worker --zone=${var.zone} --tunnel-through-iap --command='sudo docker logs -f fundraiser-worker'"
  description = "Tail Celery worker logs"
}

output "deployer_service_account" {
  value       = google_service_account.deployer.email
  description = "Set as GitHub Actions var GCP_DEPLOY_SERVICE_ACCOUNT"
}

output "workload_identity_provider" {
  value       = google_iam_workload_identity_pool_provider.github.name
  description = "Set as GitHub Actions var GCP_WORKLOAD_IDENTITY_PROVIDER"
}
