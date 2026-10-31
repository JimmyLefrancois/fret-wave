-- Journal synchronisé (D117) : une ligne par tentative, `payload` = la tentative telle que l'app la range.
-- Le serveur ne relit pas le contenu : il trie et plafonne par `ts`, l'application le normalise.
create table "attempt" ("user_id" text not null references "user" ("id") on delete cascade, "id" text not null, "ts" integer not null, "payload" text not null, primary key ("user_id", "id"));

create index "attempt_user_ts_idx" on "attempt" ("user_id", "ts");
