import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

key = os.getenv("GEMINI_API_KEY")
print("API Key loaded:", key[:8] + "..." if key else "NONE")

llm = ChatGoogleGenerativeAI(
    model="gemini-3.6-flash",
    google_api_key=key
)

try:
    response = llm.invoke("Hello, say OK!")
    print("\nSUCCESS! Gemini Response:", response.content)
except Exception as e:
    print("\nAPI Call Failed:", e)