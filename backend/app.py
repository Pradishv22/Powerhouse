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


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_object(Config)

    if test_config:
        app.config.update(test_config)

    # Enable CORS for frontend development
    # In development, TanStack start/vite runs on http://localhost:3000 or http://localhost:5173
    CORS(
        app,
        supports_credentials=True,
        origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
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

    # Initialize seed data
    with app.app_context():
        seed_admin_user()

    return app


if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("PORT", 5000))
    print(f"[PowerWise] Starting Flask API server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=True)
