use axum::{routing::get, Json, Router};
use serde::Serialize;
use tower_http::cors::CorsLayer;

#[derive(Serialize)]
struct Message {
    message: String,
}

#[derive(Serialize)]
struct Health {
    status: String,
}

async fn root() -> Json<Message> {
    Json(Message {
        message: "Welcome to {{name}}".to_string(),
    })
}

async fn health() -> Json<Health> {
    Json(Health {
        status: "healthy".to_string(),
    })
}

#[tokio::main]
async fn main() {
    tracing_subscriber::init();

    let app = Router::new()
        .route("/", get(root))
        .route("/health", get(health))
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    println!("{{name}} listening on http://localhost:8080");
    axum::serve(listener, app).await.unwrap();
}
