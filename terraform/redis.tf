resource "google_redis_instance" "main" {
  name           = "fundraiser-redis"
  tier           = "BASIC"
  memory_size_gb = 1
  region         = var.region

  authorized_network = google_compute_network.main.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"
  redis_version      = "REDIS_7_0"

  redis_configs = {
    maxmemory-policy = "allkeys-lru"
  }

  depends_on = [google_service_networking_connection.private_vpc_connection]
}
