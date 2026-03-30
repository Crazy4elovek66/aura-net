import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import crypto from "crypto";

async function handleTelegramAuth(data: any, botToken: string, origin: string, isTma: boolean) {
  let userData: any = null;
  console.log(`[Auth API] Handling ${isTma ? "TMA" : "Widget"} auth...`);

  if (isTma) {
    const initData = data.initData;
    if (!initData) throw new Error("Missing initData");

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    urlParams.delete("hash");

    const dataCheckArr = Array.from(urlParams.entries())
      .map(([key, value]) => `${key}=${value}`)
      .sort();
    const dataCheckString = dataCheckArr.join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();
    
    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (calculatedHash !== hash) {
      throw new Error("Invalid TMA hash");
    }

    const userString = urlParams.get("user");
    if (!userString) throw new Error("User data missing in initData");
    
    const tgUser = JSON.parse(userString);
    userData = {
      id: tgUser.id,
      first_name: tgUser.first_name,
      username: tgUser.username,
      photo_url: tgUser.photo_url || null
    };
  } else {
    // Widget logic
    const hash = data.hash;
    if (!hash) throw new Error("No hash provided");

    const dataCheckArr = Object.keys(data)
      .filter(key => key !== 'hash')
      .sort()
      .map(key => `${key}=${data[key]}`);
    const dataCheckString = dataCheckArr.join('\n');

    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) {
      throw new Error("Invalid Widget hash");
    }

    userData = {
      id: data.id,
      first_name: data.first_name,
      username: data.username,
      photo_url: data.photo_url || null
    };
  }

  // --- SUPABASE AUTH ---
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const telegramId = userData.id;
  const username = userData.username || `user_${telegramId}`;
  const displayName = userData.first_name || username;
  const avatarUrl = userData.photo_url;
  const dummyEmail = `${telegramId}@telegram.com`;

  // 3. Создаем или находим пользователя
  let { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
  let existingUser = users?.find(u => u.email === dummyEmail);

  // Генерируем детерминированный пароль на основе Telegram ID и секретного ключа
  const userPassword = crypto
    .createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update(telegramId.toString())
    .digest('hex');

  if (!existingUser) {
    const { data: { user }, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: dummyEmail,
      password: userPassword,
      email_confirm: true,
      user_metadata: {
        telegram_id: telegramId,
        full_name: displayName,
        avatar_url: avatarUrl,
        username: username
      }
    });
    if (createError) throw createError;
    existingUser = user!;
  } else {
    // Обновляем метаданные и принудительно синхронизируем пароль
    await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
      password: userPassword,
      user_metadata: {
        full_name: displayName,
        avatar_url: avatarUrl,
        username: username
      }
    });
  }

  // Возвращаем данные для входа на клиенте
  return { 
    email: dummyEmail,
    password: userPassword
  };
}

function getOrigin(request: Request) {
  // Приоритет заголовкам прокси (для туннелей вроде ngrok)
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  
  if (forwardedHost && forwardedProto) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  
  // Базовый вариант для локалки без туннеля
  const { origin } = new URL(request.url);
  return origin;
}

export async function GET(request: Request) {
  const origin = getOrigin(request);
  const { searchParams } = new URL(request.url);
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) return NextResponse.json({ error: "Server config error" }, { status: 500 });

  try {
    const data = Object.fromEntries(searchParams.entries());
    const authData = await handleTelegramAuth(data, botToken, origin, !!data.initData);
    return NextResponse.json(authData);
  } catch (err: any) {
    console.error("[Auth API] Error (GET):", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  let origin = getOrigin(request);
  
  if (!botToken) return NextResponse.json({ error: "Server config error" }, { status: 500 });

  try {
    const body = await request.json();
    console.log(`[Auth API] Body keys: ${Object.keys(body).join(", ")}`);
    
    const authData = await handleTelegramAuth(body, botToken, origin, true);
    console.log(`[Auth API] Hash generated successfully`);
    
    return NextResponse.json(authData);
  } catch (err: any) {
    console.error(`[Auth API] Error (POST):`, err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
