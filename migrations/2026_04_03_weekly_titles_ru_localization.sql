-- Weekly titles localization to Russian labels for existing environments (2026-04-03)

update public.weekly_titles_catalog
set
  title = case key
    when 'weekly_aura_champion' then 'Чемп ауры'
    when 'weekly_rise_rocket' then 'Ракета роста'
    when 'weekly_hype_pulse' then 'Пульс хайпа'
    else title
  end,
  description = case key
    when 'weekly_aura_champion' then 'Лидер недели по общей ауре.'
    when 'weekly_rise_rocket' then 'Самый быстрый рост ауры за 7 дней.'
    when 'weekly_hype_pulse' then 'Самый обсуждаемый профиль недели.'
    else description
  end
where key in ('weekly_aura_champion', 'weekly_rise_rocket', 'weekly_hype_pulse');
