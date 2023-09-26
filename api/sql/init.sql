CREATE EXTENSION IF NOT EXISTS pg_trgm;



-- DROP SCHEMA IF EXISTS exams;
CREATE SCHEMA IF NOT EXISTS exams AUTHORIZATION postgres;
-- DROP SCHEMA IF EXISTS lessons;
CREATE SCHEMA IF NOT EXISTS lessons AUTHORIZATION postgres;
-- DROP SCHEMA IF EXISTS publishers;
CREATE SCHEMA IF NOT EXISTS publishers AUTHORIZATION postgres;
-- DROP SCHEMA IF EXISTS users;
CREATE SCHEMA IF NOT EXISTS users AUTHORIZATION postgres;



-- DROP TABLE IF EXISTS public.publishers;
CREATE TABLE IF NOT EXISTS public.publishers (
    id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    name text COLLATE pg_catalog."default" NOT NULL,
    CONSTRAINT publishers_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;
ALTER TABLE IF EXISTS public.publishers OWNER to postgres;



-- DROP TABLE IF EXISTS public.lessons;
CREATE TABLE IF NOT EXISTS public.lessons
(
    id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    name text COLLATE pg_catalog."default" NOT NULL,
    CONSTRAINT lessons_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;
ALTER TABLE IF EXISTS public.lessons OWNER to postgres;



-- DROP TABLE IF EXISTS public.users;
CREATE TABLE IF NOT EXISTS public.users
(
    id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    name text COLLATE pg_catalog."default" NOT NULL,
    key text COLLATE pg_catalog."default" NOT NULL,
    CONSTRAINT users_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;
ALTER TABLE IF EXISTS public.users OWNER to postgres;



-- DROP TABLE IF EXISTS public.books;
CREATE TABLE IF NOT EXISTS public.books (
    id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    publisher_id integer NOT NULL,
    lesson_id integer NOT NULL,
    name text COLLATE pg_catalog."default" NOT NULL,
    page integer[] NOT NULL,
    CONSTRAINT books_pkey PRIMARY KEY (id),
    CONSTRAINT books_lesson_id FOREIGN KEY (lesson_id)
        REFERENCES public.lessons (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID,
    CONSTRAINT books_publisher_id FOREIGN KEY (publisher_id)
        REFERENCES public.publishers (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID
) TABLESPACE pg_default;
ALTER TABLE IF EXISTS public.books OWNER to postgres;
-- DROP INDEX IF EXISTS public.books_lesson_id;
CREATE INDEX IF NOT EXISTS books_lesson_id
    ON public.books USING btree
    (lesson_id ASC NULLS LAST)
    TABLESPACE pg_default;
-- DROP INDEX IF EXISTS public.books_publisher_id;
CREATE INDEX IF NOT EXISTS books_publisher_id
    ON public.books USING btree
    (publisher_id ASC NULLS LAST)
    TABLESPACE pg_default;
    
    

-- DROP TABLE IF EXISTS exams.categories;
CREATE TABLE IF NOT EXISTS exams.categories (
    id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    name text COLLATE pg_catalog."default" NOT NULL,
    question_count integer NOT NULL,
    schema integer[] NOT NULL,
    CONSTRAINT categories_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;
ALTER TABLE IF EXISTS exams.categories OWNER to postgres;


-- DROP TABLE IF EXISTS public.exams;
CREATE TABLE IF NOT EXISTS public.exams (
    id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    publisher_id integer NOT NULL,
    category_id integer NOT NULL,
    user_id integer NOT NULL,
    net numeric NOT NULL,
    nets numeric[] NOT NULL,
    duration interval NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    name text COLLATE pg_catalog."default",
    full_name text COLLATE pg_catalog."default",
    CONSTRAINT exams_pkey PRIMARY KEY (id),
    CONSTRAINT exams_category_id FOREIGN KEY (category_id)
        REFERENCES exams.categories (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID,
    CONSTRAINT exams_publisher_id FOREIGN KEY (publisher_id)
        REFERENCES public.publishers (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID,
    CONSTRAINT exams_user_id FOREIGN KEY (user_id)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID
) TABLESPACE pg_default;
ALTER TABLE IF EXISTS public.exams OWNER to postgres;
-- DROP INDEX IF EXISTS public.exams_index;
CREATE INDEX IF NOT EXISTS exams_index
    ON public.exams USING gist
    (full_name COLLATE pg_catalog."default" gist_trgm_ops)
    INCLUDE(id)
    TABLESPACE pg_default;
-- DROP INDEX IF EXISTS public.exams_category_id;
CREATE INDEX IF NOT EXISTS exams_category_id
    ON public.exams USING btree
    (category_id ASC NULLS LAST)
    TABLESPACE pg_default;
-- DROP INDEX IF EXISTS public.exams_publisher_id;
CREATE INDEX IF NOT EXISTS exams_publisher_id
    ON public.exams USING btree
    (publisher_id ASC NULLS LAST)
    TABLESPACE pg_default;
-- DROP INDEX IF EXISTS public.exams_user_id;
CREATE INDEX IF NOT EXISTS exams_user_id
    ON public.exams USING btree
    (user_id ASC NULLS LAST)
    TABLESPACE pg_default;



-- DROP TABLE IF EXISTS public.questions;
CREATE TABLE IF NOT EXISTS public.questions (
    book_id integer NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    count integer NOT NULL
) TABLESPACE pg_default;
ALTER TABLE IF EXISTS public.questions OWNER to postgres;
