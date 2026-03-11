import modal
from pathlib import Path
ROOT_DIR=Path(__file__).resolve().parent
app=modal.App("webtime-backend")

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "fastapi",
        "httpx",
        "cachetools",
    )
    .add_local_python_source("server")
)

@app.function(image=image)
@modal.asgi_app()
def fastapi_app():
    import server
    return server.app

