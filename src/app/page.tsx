import { HomeScreen } from "@/components/HomeScreen";
import { Logo } from "@/components/Logo";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-4 py-10">
      <Logo />
      <HomeScreen />
    </main>
  );
}
