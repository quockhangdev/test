from __future__ import annotations

import os

from . import create_app


def main():
    app = create_app()
    app.run(
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "5000")),
        debug=os.environ.get("FLASK_ENV", "development") == "development",
    )


if __name__ == "__main__":
    main()

