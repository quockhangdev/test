from __future__ import annotations

import os

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_sqlalchemy import SQLAlchemy

load_dotenv()

db = SQLAlchemy()
jwt = JWTManager()


def create_app() -> Flask:
    app = Flask(__name__)

    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret")
    app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "dev-jwt-secret")
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
        "DATABASE_URL", "sqlite:///app.db"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
    print(cors_origins)
    CORS(app, resources={r"/api/*": {"origins": [o.strip() for o in cors_origins]}})

    db.init_app(app)
    jwt.init_app(app)

    from .routes import api_bp

    app.register_blueprint(api_bp, url_prefix="/api")

    return app
