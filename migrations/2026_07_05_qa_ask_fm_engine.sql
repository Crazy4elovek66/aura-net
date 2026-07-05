-- Q&A (Ask.fm Engine) integration migration (2026-07-05)

-- Таблица вопросов
create table if not exists public.qa_questions (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references public.profiles(id) on delete set null,
  receiver_id uuid references public.profiles(id) on delete cascade not null,
  text varchar(1000) not null,
  is_anonymous boolean not null default false,
  is_answered boolean not null default false,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- Таблица ответов
create table if not exists public.qa_answers (
  id uuid default gen_random_uuid() primary key,
  question_id uuid references public.qa_questions(id) on delete cascade not null unique,
  text varchar(4000) not null,
  media_type text not null check (media_type in ('text', 'photo', 'video_note')),
  media_file_id text,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- Таблица лайков ответов
create table if not exists public.qa_answer_likes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  answer_id uuid references public.qa_answers(id) on delete cascade not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint qa_answer_likes_user_answer_unique unique (user_id, answer_id)
);

-- Индексы для фида стены ответов и инбокса
create index if not exists qa_questions_receiver_answered_created_idx
  on public.qa_questions (receiver_id, is_answered, created_at desc);

create index if not exists qa_questions_sender_idx
  on public.qa_questions (sender_id)
  where sender_id is not null;

create index if not exists qa_answers_question_idx
  on public.qa_answers (question_id);

create index if not exists qa_answer_likes_answer_idx
  on public.qa_answer_likes (answer_id);

-- Включение Row Level Security (RLS)
alter table public.qa_questions enable row level security;
alter table public.qa_answers enable row level security;
alter table public.qa_answer_likes enable row level security;

-- RLS Политики для qa_questions
create policy qa_questions_select on public.qa_questions
  for select using (is_answered = true or receiver_id = auth.uid() or sender_id = auth.uid());

create policy qa_questions_insert on public.qa_questions
  for insert with check (auth.uid() = sender_id);

create policy qa_questions_delete on public.qa_questions
  for delete using (receiver_id = auth.uid());

-- RLS Политики для qa_answers
create policy qa_answers_select on public.qa_answers
  for select using (
    exists (
      select 1 from public.qa_questions q
      where q.id = question_id and (q.is_answered = true or q.receiver_id = auth.uid())
    )
  );

create policy qa_answers_insert on public.qa_answers
  for insert with check (
    exists (
      select 1 from public.qa_questions q
      where q.id = question_id and q.receiver_id = auth.uid()
    )
  );

create policy qa_answers_delete on public.qa_answers
  for delete using (
    exists (
      select 1 from public.qa_questions q
      where q.id = question_id and q.receiver_id = auth.uid()
    )
  );

-- RLS Политики для qa_answer_likes
create policy qa_answer_likes_select on public.qa_answer_likes
  for select using (true);

create policy qa_answer_likes_insert on public.qa_answer_likes
  for insert with check (auth.uid() = user_id);

create policy qa_answer_likes_delete on public.qa_answer_likes
  for delete using (auth.uid() = user_id);

-- RPC: submit_question (Отправка вопроса)
create or replace function public.submit_question(
  p_receiver_id uuid,
  p_text text,
  p_is_anonymous boolean
)
returns table (question_id uuid, aura_left integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
  v_sender_aura integer;
  v_cost integer := 15; -- ANONYMOUS_QUESTION_COST
  v_q_id uuid;
begin
  if p_receiver_id is null then
    raise exception 'Receiver id is required';
  end if;
  if p_text is null or length(btrim(p_text)) = 0 then
    raise exception 'Question text cannot be empty';
  end if;
  if length(p_text) > 1000 then
    raise exception 'Question text is too long';
  end if;

  -- Авторизация обязательна
  if v_sender_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Проверяем, что получатель существует
  if not exists (select 1 from public.profiles where id = p_receiver_id) then
    raise exception 'Receiver profile not found';
  end if;

  if p_is_anonymous then
    -- Проверяем и списываем ауру отправителя
    select p.aura_points into v_sender_aura from public.profiles p where p.id = v_sender_id for update;
    if v_sender_aura < v_cost then
      raise exception 'Insufficient aura for anonymous question';
    end if;

    update public.profiles set aura_points = v_sender_aura - v_cost where id = v_sender_id;

    -- Записываем транзакцию
    insert into public.transactions (user_id, amount, type, description, metadata)
    values (
      v_sender_id,
      -v_cost,
      'anonymous_question_fee',
      'Плата за анонимный вопрос',
      jsonb_build_object('cost', v_cost, 'receiver_id', p_receiver_id)
    );
    v_sender_aura := v_sender_aura - v_cost;
  else
    select p.aura_points into v_sender_aura from public.profiles p where p.id = v_sender_id;
  end if;

  -- Вставляем вопрос
  insert into public.qa_questions (sender_id, receiver_id, text, is_anonymous, is_answered)
  values (v_sender_id, p_receiver_id, p_text, p_is_anonymous, false)
  returning id into v_q_id;

  return query select v_q_id, v_sender_aura;
end;
$$;

-- RPC: answer_question (Ответ на вопрос)
create or replace function public.answer_question(
  p_question_id uuid,
  p_text text,
  p_media_type text default 'text',
  p_media_file_id text default null
)
returns table (answer_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_receiver_id uuid;
  v_sender_id uuid;
  v_is_anonymous boolean;
  v_ans_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_text is null or length(btrim(p_text)) = 0 then
    raise exception 'Answer text cannot be empty';
  end if;
  if length(p_text) > 4000 then
    raise exception 'Answer text is too long';
  end if;
  if p_media_type not in ('text', 'photo', 'video_note') then
    raise exception 'Invalid media type';
  end if;

  -- Находим вопрос и проверяем, что текущий пользователь является получателем
  select receiver_id, sender_id, is_anonymous
    into v_receiver_id, v_sender_id, v_is_anonymous
    from public.qa_questions
    where id = p_question_id;

  if not found then
    raise exception 'Question not found';
  end if;

  if v_receiver_id <> v_user_id then
    raise exception 'You can only answer questions sent to you';
  end if;

  -- Проверяем, не отвечен ли вопрос уже
  if exists (select 1 from public.qa_answers where question_id = p_question_id) then
    raise exception 'Question has already been answered';
  end if;

  -- Вставляем ответ
  insert into public.qa_answers (question_id, text, media_type, media_file_id)
  values (p_question_id, p_text, p_media_type, p_media_file_id)
  returning id into v_ans_id;

  -- Отмечаем вопрос как отвеченный
  update public.qa_questions set is_answered = true where id = p_question_id;

  return query select v_ans_id;
end;
$$;

-- RPC: like_qa_answer (Лайк/дизлайк ответа)
create or replace function public.like_qa_answer(
  p_answer_id uuid
)
returns table (likes_count integer, author_aura integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_author_id uuid;
  v_likes_count integer;
  v_author_aura integer;
  v_reward integer := 1; -- QA_ANSWER_LIKE_REWARD
  v_question_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Находим автора ответа (receiver_id вопроса)
  select q.receiver_id, a.question_id
    into v_author_id, v_question_id
    from public.qa_answers a
    join public.qa_questions q on q.id = a.question_id
    where a.id = p_answer_id;

  if not found then
    raise exception 'Answer not found';
  end if;

  -- Проверяем, не пытается ли пользователь лайкнуть собственный ответ
  if v_author_id = v_user_id then
    raise exception 'Cannot like your own answer';
  end if;

  -- Проверяем, был ли уже поставлен лайк
  if exists (select 1 from public.qa_answer_likes where user_id = v_user_id and answer_id = p_answer_id) then
    -- Убираем лайк (Toggle-лайк)
    delete from public.qa_answer_likes where user_id = v_user_id and answer_id = p_answer_id;
    
    -- Списываем 1 очко у автора ответа
    select aura_points into v_author_aura from public.profiles where id = v_author_id for update;
    v_author_aura := greatest(v_author_aura - v_reward, 0);
    update public.profiles set aura_points = v_author_aura where id = v_author_id;

    -- Записываем транзакцию
    insert into public.transactions (user_id, amount, type, description, metadata)
    values (
      v_author_id,
      -v_reward,
      'qa_answer_like_removed',
      'Лайк ответа отменен',
      jsonb_build_object('answer_id', p_answer_id, 'liker_id', v_user_id)
    );
  else
    -- Ставим лайк
    insert into public.qa_answer_likes (user_id, answer_id)
    values (v_user_id, p_answer_id);

    -- Начисляем +1 очко автору ответа
    select aura_points into v_author_aura from public.profiles where id = v_author_id for update;
    v_author_aura := v_author_aura + v_reward;
    update public.profiles set aura_points = v_author_aura where id = v_author_id;

    -- Запускаем прогрессию
    perform public.process_profile_progression(
      v_author_id,
      v_author_aura - v_reward,
      v_author_aura,
      jsonb_build_object('source', 'qa_answer_like', 'answer_id', p_answer_id)
    );

    -- Записываем транзакцию
    insert into public.transactions (user_id, amount, type, description, metadata)
    values (
      v_author_id,
      v_reward,
      'qa_answer_like',
      'Лайк за ответ на вопрос',
      jsonb_build_object('answer_id', p_answer_id, 'liker_id', v_user_id)
    );
  end if;

  -- Считаем общее число лайков
  select count(*)::integer into v_likes_count from public.qa_answer_likes where answer_id = p_answer_id;

  return query select v_likes_count, v_author_aura;
end;
$$;

-- RPC: deanon_question_by_admin (Админ-раскрытие автора)
create or replace function public.deanon_question_by_admin(
  p_question_id uuid
)
returns table (sender_username text, sender_display_name text, sender_telegram_id bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_sender_id uuid;
  v_is_anonymous boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Проверяем, что вызывающий является админом
  if not public.is_platform_admin(v_user_id) then
    raise exception 'Only platform admins can perform de-anonymization';
  end if;

  -- Находим вопрос
  select sender_id, is_anonymous
    into v_sender_id, v_is_anonymous
    from public.qa_questions
    where id = p_question_id;

  if not found then
    raise exception 'Question not found';
  end if;

  if v_sender_id is null then
    raise exception 'Sender not found or not registered';
  end if;

  -- Логируем админское действие в ops_events
  insert into public.ops_events (level, scope, event_type, actor_id, message, payload)
  values (
    'warn',
    'admin_moderation',
    'admin_deanon_action',
    v_user_id,
    format('Администратор раскрыл автора вопроса %s', p_question_id),
    jsonb_build_object('question_id', p_question_id, 'sender_id', v_sender_id)
  );

  return query
    select p.username, p.display_name, p.telegram_id
    from public.profiles p
    where p.id = v_sender_id;
end;
$$;

-- Настройка прав выполнения
revoke execute on function public.submit_question(uuid, text, boolean) from anon;
grant execute on function public.submit_question(uuid, text, boolean) to authenticated;
grant execute on function public.submit_question(uuid, text, boolean) to service_role;

revoke execute on function public.answer_question(uuid, text, text, text) from anon;
grant execute on function public.answer_question(uuid, text, text, text) to authenticated;
grant execute on function public.answer_question(uuid, text, text, text) to service_role;

revoke execute on function public.like_qa_answer(uuid) from anon;
grant execute on function public.like_qa_answer(uuid) to authenticated;
grant execute on function public.like_qa_answer(uuid) to service_role;

revoke execute on function public.deanon_question_by_admin(uuid) from anon;
grant execute on function public.deanon_question_by_admin(uuid) to authenticated;
grant execute on function public.deanon_question_by_admin(uuid) to service_role;
