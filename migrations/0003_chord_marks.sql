-- Coches de la liste d'accords (D140) : une ligne par forme. Un décochage reste une ligne, sinon un autre
-- appareil rétablirait la coche. La modification la plus récente gagne, forme par forme.
create table "chord_mark" ("user_id" text not null references "user" ("id") on delete cascade, "chord_id" text not null, "known" integer not null, "no_review" integer not null, "updated_at" integer not null, primary key ("user_id", "chord_id"));
