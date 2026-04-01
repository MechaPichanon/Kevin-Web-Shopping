import ChatPage from "./chat/ChatPage";

export default function Home() {
  return (
    <main className="flex min-h-full flex-1 flex-col bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Web Shopping Chatbot Demo
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Ask about products (shirts, pants, jackets).
        </p>

        <div className="mt-6 flex-1">
          <ChatPage />
        </div>
      </div>
    </main>
  );
}
