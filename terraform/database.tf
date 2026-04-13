resource "random_password" "db_password" {
  length  = 32
  special = false
}

resource "google_sql_database_instance" "primary" {
  name             = "fundraiser-pg"
  database_version = "POSTGRES_16"
  region           = var.region

  depends_on = [google_service_networking_connection.private_vpc_connection]

  settings {
    tier              = var.db_tier
    edition           = "ENTERPRISE"
    availability_type = "ZONAL"
    disk_size         = 10
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "03:00"
      backup_retention_settings {
        retained_backups = 7
      }
    }
  }

  deletion_protection = true
}

resource "google_sql_database" "hakuna" {
  name     = "hakuna"
  instance = google_sql_database_instance.primary.name
}

resource "google_sql_user" "app" {
  name     = "hakuna"
  instance = google_sql_database_instance.primary.name
  password = random_password.db_password.result
}
