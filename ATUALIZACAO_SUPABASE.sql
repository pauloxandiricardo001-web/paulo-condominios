-- Execute este SQL no Supabase antes de testar a nova versão.
-- Ele NÃO apaga lançamentos existentes. Apenas adiciona novas colunas.

alter table despesas
add column if not exists tipo_pagamento text default 'pix';

alter table despesas
add column if not exists chave_pix text;

alter table despesas
add column if not exists recorrente_mensal boolean default false;

alter table despesas disable row level security;
alter table anexos disable row level security;

-- Corrige permissões do Storage para upload e leitura pública no bucket documentos.
-- Se alguma policy já existir, ela é removida e criada novamente.

drop policy if exists "Permitir upload publico" on storage.objects;
drop policy if exists "Permitir leitura publica" on storage.objects;

create policy "Permitir upload publico"
on storage.objects
for insert
to public
with check (bucket_id = 'documentos');

create policy "Permitir leitura publica"
on storage.objects
for select
to public
using (bucket_id = 'documentos');
