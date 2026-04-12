from __future__ import annotations

import os

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from mongoengine import connect

load_dotenv()

jwt = JWTManager()


def create_app() -> Flask:
    app = Flask(__name__)

    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret")
    app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "dev-jwt-secret")

    mongo_uri = os.environ.get("MONGODB_URI", "mongodb://127.0.0.1:27017/onthitinhoc")
    connect(host=mongo_uri, alias="default")

    cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
    CORS(app, resources={r"/api/*": {"origins": [o.strip() for o in cors_origins]}})

    jwt.init_app(app)

    from .routes import api_bp

    app.register_blueprint(api_bp, url_prefix="/api")

    @app.route("/")
    def index():
        return "Hello, World!"

    return app
