# Dedicated VPC so this app's Cloud SQL/Redis private IPs don't collide with the
# main hakuna stack (which uses its own VPC in a different project).

resource "google_compute_network" "main" {
  name                    = "fundraiser-vpc"
  auto_create_subnetworks = false

  depends_on = [google_project_service.apis]
}

resource "google_compute_subnetwork" "main" {
  name          = "fundraiser-subnet"
  ip_cidr_range = "10.20.0.0/20"
  region        = var.region
  network       = google_compute_network.main.id

  private_ip_google_access = true
}

# Private service connection — required for Cloud SQL and Memorystore private IPs.
resource "google_compute_global_address" "private_ip_range" {
  name          = "fundraiser-private-ip-range"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}

# VPC connector — Cloud Run uses this to reach Cloud SQL/Redis private IPs.
resource "google_vpc_access_connector" "main" {
  name          = "fundraiser-vpc-conn"
  region        = var.region
  network       = google_compute_network.main.name
  ip_cidr_range = "10.28.0.0/28"
  min_instances = 2
  max_instances = 3
  machine_type  = "e2-micro"

  depends_on = [google_compute_subnetwork.main]
}

# NAT — lets the worker VM reach external APIs (Crunchbase, Anthropic, etc.)
# without giving it a public IP.
resource "google_compute_router" "main" {
  name    = "fundraiser-router"
  region  = var.region
  network = google_compute_network.main.id
}

resource "google_compute_router_nat" "main" {
  name                               = "fundraiser-nat"
  router                             = google_compute_router.main.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}

resource "google_compute_firewall" "allow_internal" {
  name    = "fundraiser-allow-internal"
  network = google_compute_network.main.name

  allow { protocol = "tcp" }
  allow { protocol = "icmp" }

  source_ranges = ["10.20.0.0/16", "10.28.0.0/28"]
}

# SSH via IAP — no public IP needed on the worker VM.
resource "google_compute_firewall" "allow_iap_ssh" {
  name    = "fundraiser-allow-iap-ssh"
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["allow-iap-ssh"]
}
