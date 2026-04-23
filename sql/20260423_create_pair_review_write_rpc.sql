-- Tight write RPC for pair-review.
-- Keeps the hot path to one targeted update with the existing caller payload.

create or replace function public.write_pair_review(
  p_user_id uuid,
  p_pair_id uuid,
  p_deck_id uuid,
  p_stage text,
  p_dir text
)
returns void
language plpgsql
volatile
as $$
begin
  if p_stage not in ('word', 'sentence') then
    raise exception 'invalid_review_stage';
  end if;

  if p_dir not in ('active', 'passive') then
    raise exception 'invalid_review_dir';
  end if;

  update public.user_pairs
  set
    word_last_reviewed_at = case
      when p_stage = 'word' and p_dir = 'passive' then now()
      else public.user_pairs.word_last_reviewed_at
    end,
    sentence_last_reviewed_at = case
      when p_stage = 'sentence' and p_dir = 'passive' then now()
      else public.user_pairs.sentence_last_reviewed_at
    end,
    word_active_last_reviewed_at = case
      when p_stage = 'word' and p_dir = 'active' then now()
      else public.user_pairs.word_active_last_reviewed_at
    end,
    sentence_active_last_reviewed_at = case
      when p_stage = 'sentence' and p_dir = 'active' then now()
      else public.user_pairs.sentence_active_last_reviewed_at
    end
  where user_id = p_user_id
    and deck_id = p_deck_id
    and pair_id = p_pair_id;
end;
$$;
