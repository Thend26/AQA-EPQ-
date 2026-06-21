grant select on table public.feedbacks to authenticated;
grant select on table public.feedback_context_records to authenticated;
grant select on table public.feedback_messages to authenticated;

revoke insert, update, delete on table public.feedbacks from authenticated;
revoke insert, update, delete on table public.feedback_context_records from authenticated;
revoke insert, update, delete on table public.feedback_messages from authenticated;
