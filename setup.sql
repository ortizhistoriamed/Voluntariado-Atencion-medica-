-- Ejecuta esto en el SQL Editor de Supabase

create table if not exists pacientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  edad int,
  patologias text,
  medicamentos text,
  alergias text,
  motivo_consulta text,
  telefono text,
  created_at timestamptz default now()
);

create table if not exists medicos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  especialidad text,
  created_at timestamptz default now()
);

create table if not exists consultas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid references pacientes(id),
  medico_id uuid references medicos(id),
  anamnesis text,
  examen_fisico text,
  diagnostico text,
  notas text,
  recipe jsonb,
  created_at timestamptz default now()
);

-- Habilitar RLS (Opcional por ahora para desarrollo)
alter table consultas enable row level security;
create policy "Public access" on consultas for all using (true);
create policy "Public access" on pacientes for all using (true);
create policy "Public access" on medicos for all using (true);

-- Insertar un médico de prueba si no existe
insert into medicos (id, nombre, especialidad) 
values ('88888888-8888-4888-8888-888888888888', 'Dr. Voluntario General', 'Medicina General')
on conflict do nothing;
