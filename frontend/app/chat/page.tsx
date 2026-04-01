import ChatPage from "./ChatPage";

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        Web Shopping Chatbot
      </h1>
      <p className="mt-2 text-sm text-zinc-200">
        Ask about products (shirts, pants, jackets).
      </p>

      <div className="mt-6">
        <ChatPage />
      </div>
    </main>
  );
}
