alter table public.user_settings
  drop constraint if exists user_settings_theme_preset_check;

alter table public.user_settings
  add constraint user_settings_theme_preset_check
  check (
    theme_preset in (
      'professional',
      'ocean',
      'sunrise',
      'forest',
      'lavender',
      'graphite',
      'rose',
      'mint',
      'custom'
    )
  );
