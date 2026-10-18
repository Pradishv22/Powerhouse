import os
from flask import Flask, jsonify
from flask_cors import CORS
from backend.config import Config
from backend.auth import seed_admin_user
from backend.routes.auth_routes import auth_bp
from backend.routes.appliance_routes import appliance_bp
from backend.routes.dataset_routes import dataset_bp
from backend.routes.analytics_routes import analytics_bp
from backend.routes.report_routes import report_bp
from backend.routes.admin_routes import admin_bp
from backend.routes.health_routes import health_bp
from backend.routes.savings_routes import savings_bp


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_object(Config)

    if test_config:
        app.config.update(test_config)

    # Enable CORS for frontend development
    # Allows exact origins including port 8080 (Lovable Vite dev server), 5173, and 3000
    CORS(
        app,
        supports_credentials=True,
        origins=Config.CORS_ORIGINS,
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["Content-Type", "Set-Cookie"],
    )

    # Global standard error handler
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": {"code": "BAD_REQUEST", "message": str(e.description or "Bad request")}}), 400

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Resource not found"}}), 404

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"error": {"code": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred."}}), 500

    # Register blueprints under /api/v1
    app.register_blueprint(auth_bp)
    app.register_blueprint(appliance_bp)
    app.register_blueprint(dataset_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(report_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(savings_bp)

    # Initialize seed data
    with app.app_context():
        seed_admin_user()

    return app


if __name__ == "__main__":
    import socket
    port = int(os.getenv("PORT", 5000))
    if os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) == 0:
                print(f"[PowerWise WARNING] Port {port} is already in use by another process!")
                print(f"[PowerWise TIP] If an existing Flask instance is running, terminate it before starting a new one.")
    app = create_app()
    print(f"[PowerWise] Starting Flask API server on port {port}...")
    print(f"[PowerWise] Configured CORS origins: {Config.CORS_ORIGINS}")
    app.run(host="0.0.0.0", port=port, debug=True)
