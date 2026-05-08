-- v0.10.0: tabla connection_access para sharing granular de conexiones.
-- El dueño (user_connections.user_id) NO aparece aquí — solo invitados.
-- permission ∈ ('read','write'). PK compuesto (connection_id, user_id).
-- ON DELETE CASCADE en ambas FKs: borrar conexión o user limpia rows.

CREATE TABLE "connection_access" (
	"connection_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"permission" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connection_access_connection_id_user_id_pk" PRIMARY KEY("connection_id","user_id"),
	CONSTRAINT "connection_access_permission_check" CHECK ("permission" IN ('read', 'write'))
);
--> statement-breakpoint
ALTER TABLE "connection_access" ADD CONSTRAINT "connection_access_connection_id_user_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."user_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_access" ADD CONSTRAINT "connection_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
-- NOTA: drizzle-kit sugirió aquí "DROP TABLE intuit_tokens CASCADE" porque
-- el snapshot 0007 aún lista intuit_tokens, pero la DB ya tiene la tabla
-- renombrada como intuit_tokens_deprecated (rename manual en v0.8.0,
-- D-mapi-027). El drop real está planeado para v0.8.1; aquí lo OMITIMOS
-- a propósito.
