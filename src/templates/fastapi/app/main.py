from fastapi import FastAPI

app = FastAPI(title="{{PROJECT_NAME}}")


@app.get("/")
async def root():
    return {"message": "Welcome to {{PROJECT_NAME}}"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
