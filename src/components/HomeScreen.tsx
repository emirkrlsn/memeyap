"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  normalizeRoomCode,
  normalizeUsername,
  ROOM_CODE_LENGTH,
  USERNAME_MAX_LENGTH,
} from "@/lib/game-rules";
import { errorMessage, strings } from "@/lib/strings";
import { ensureAnonymousSession } from "@/lib/supabase/auth";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useHydrated } from "@/lib/use-hydrated";

const USERNAME_STORAGE_KEY = "memeyap:username";

function readStoredUsername(): string {
  try {
    return localStorage.getItem(USERNAME_STORAGE_KEY) ?? "";
  } catch {
    return ""; // Tarayıcı depolaması kapalı olabilir.
  }
}

type Props = {
  /** Oda bağlantısıyla gelindiyse kod önceden doldurulur. */
  initialCode?: string;
  /** Katıldıktan sonra yönlendirme yerine çağrılır (oda sayfasındayken). */
  onJoined?: () => void;
};

export function HomeScreen({ initialCode = "", onJoined }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [username, setUsername] = useState("");
  const [code, setCode] = useState(initialCode);
  const [currentRoomCode, setCurrentRoomCode] = useState<string | null>(null);
  const [pending, setPending] = useState<"create" | "join" | null>(null);
  const [usernameError, setUsernameError] = useState<string>();
  const [codeError, setCodeError] = useState<string>();

  useEffect(() => {
    ensureAnonymousSession()
      .then((user) => {
        // Son kullanılan adı hatırla (kullanıcı henüz yazmadıysa).
        setUsername((current) => current || readStoredUsername());
        // Kullanıcı zaten bir odadaysa geri dönebilsin.
        return getSupabaseClient()
          .from("players")
          .select("rooms!players_room_id_fkey(code)")
          .eq("user_id", user.id)
          .maybeSingle();
      })
      .then(({ data }) => setCurrentRoomCode(data?.rooms?.code ?? null))
      .catch((error: unknown) =>
        console.error("[MemeYap] Oturum açılamadı:", error),
      );
  }, []);

  async function submit(action: "create" | "join") {
    const name = normalizeUsername(username);
    setUsernameError(name ? undefined : strings.errors.USERNAME_INVALID);
    const roomCode = normalizeRoomCode(code);
    const codeValid =
      action === "create" || roomCode.length === ROOM_CODE_LENGTH;
    setCodeError(codeValid ? undefined : strings.errors.ROOM_CODE_INVALID);
    if (!name || !codeValid) return;

    setPending(action);
    try {
      await ensureAnonymousSession();
      const supabase = getSupabaseClient();
      const { data, error } =
        action === "create"
          ? await supabase.rpc("create_room", { p_username: name })
          : await supabase.rpc("join_room", {
              p_code: roomCode,
              p_username: name,
            });
      if (error) throw error;

      try {
        localStorage.setItem(USERNAME_STORAGE_KEY, name);
      } catch {
        // Kaydedilemezse bir dahaki sefere tekrar yazar.
      }
      if (onJoined) onJoined();
      else router.push(`/oda/${data}`);
    } catch (error) {
      const message = errorMessage(error);
      const usernameErrors: string[] = [
        strings.errors.USERNAME_INVALID,
        strings.errors.USERNAME_TAKEN,
      ];
      const isCodeError =
        action === "join" && !usernameErrors.includes(message);
      (isCodeError ? setCodeError : setUsernameError)(message);
      setPending(null);
    }
  }

  function onJoinSubmit(event: FormEvent) {
    event.preventDefault();
    void submit("join");
  }

  return (
    <div className="flex w-full flex-col gap-5">
      {currentRoomCode && !onJoined && (
        <Card className="flex flex-col items-center gap-3 text-center">
          <p className="font-extrabold">
            {strings.home.alreadyInRoom(currentRoomCode)}
          </p>
          <Button
            variant="success"
            onClick={() => router.push(`/oda/${currentRoomCode}`)}
          >
            {strings.home.backToRoom}
          </Button>
        </Card>
      )}

      <Card className="flex flex-col gap-5">
        <Input
          label={strings.home.usernameLabel}
          placeholder={strings.home.usernamePlaceholder}
          hint={strings.home.usernameHint}
          error={usernameError}
          value={username}
          maxLength={USERNAME_MAX_LENGTH * 2}
          autoComplete="nickname"
          disabled={!hydrated}
          onChange={(event) => setUsername(event.target.value)}
        />

        {!onJoined && (
          <>
            <Button
              size="lg"
              fullWidth
              disabled={pending !== null || !hydrated}
              onClick={() => void submit("create")}
            >
              {pending === "create"
                ? strings.common.loading
                : strings.home.create}
            </Button>
            <div className="flex items-center gap-3 text-sm font-extrabold text-ink-soft">
              <span className="h-[3px] flex-1 rounded-full bg-ink/10" />
              {strings.home.or}
              <span className="h-[3px] flex-1 rounded-full bg-ink/10" />
            </div>
          </>
        )}

        <form className="flex flex-col gap-3" onSubmit={onJoinSubmit}>
          <Input
            label={strings.home.codeLabel}
            placeholder={strings.home.codePlaceholder}
            error={codeError}
            value={code}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="text-center font-meme text-2xl tracking-[0.3em] uppercase"
            disabled={!hydrated}
            onChange={(event) => setCode(normalizeRoomCode(event.target.value))}
          />
          <Button
            type="submit"
            variant="secondary"
            size="lg"
            fullWidth
            disabled={pending !== null || !hydrated}
          >
            {pending === "join" ? strings.common.loading : strings.home.join}
          </Button>
        </form>
      </Card>
    </div>
  );
}
