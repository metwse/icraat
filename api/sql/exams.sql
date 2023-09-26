-- DROP FUNCTION IF EXISTS exams.get;
CREATE OR REPLACE FUNCTION exams.get(_id integer)
RETURNS TABLE (id integer, publisher_id integer, category_id integer, user_id integer, name text, net numeric, nets numeric[], duration numeric, "timestamp" timestamp with time zone) 
LANGUAGE plpgsql AS $$
BEGIN
	RETURN QUERY SELECT exams.id, exams.publisher_id, exams.category_id, exams.user_id, exams.name, exams.net, exams.nets, EXTRACT(epoch FROM exams.duration) / 60, exams.timestamp FROM exams WHERE exams.id = _id;
END $$;



-- DROP FUNCTION IF EXISTS exams.search;
CREATE OR REPLACE FUNCTION exams.search(_text text, _filter text[], _before numeric DEFAULT 'Infinity'::numeric)
RETURNS TABLE (ids integer[], count bigint) 
LANGUAGE plpgsql AS $$
DECLARE
	__publisher_id integer[];
	__category_id integer[];
	__user_id integer[];
BEGIN
	BEGIN IF _filter[1] IS NOT null THEN __publisher_id := string_to_array(_filter[1], ',')::integer[]; END IF;
	EXCEPTION WHEN others THEN null; END;
	BEGIN IF _filter[2] IS NOT null THEN __category_id := string_to_array(_filter[2], ',')::integer[]; END IF;
	EXCEPTION WHEN others THEN null; END;
	BEGIN IF _filter[3] IS NOT null THEN __user_id := string_to_array(_filter[3], ',')::integer[]; END IF;
	EXCEPTION WHEN others THEN null; END;
	RETURN QUERY SELECT ARRAY(
		(SELECT exams.id FROM exams WHERE exams.id < _before AND 
		 ((__publisher_id IS null) OR CARDINALITY(__publisher_id) = 0 OR exams.publisher_id = ANY(__publisher_id)) AND
		 ((__user_id IS null) OR CARDINALITY(__user_id) = 0 OR exams.user_id = ANY(__user_id)) AND
         ((__category_id IS null) OR CARDINALITY(__category_id) = 0 OR exams.category_id = ANY(__category_id)) 
		 ORDER BY similarity(_text, exams.full_name) DESC, id DESC LIMIT 10)
	), 0::bigint;
END $$;


/*
exams.new('<publisher_id>:<category_id> <name>', [[<wrong_count>, <blank_count>, <total_questions?>], ...], duration, timestamp?)
RETURNS <positive_integer> IF succesfully completed
RETURNS 0 IF error
*/ 
-- DROP FUNCTION IF EXISTS exams.new;
CREATE OR REPLACE FUNCTION exams.new(_user_id integer, _details text, _nets integer[], _duration text, _timestamp timestamp with time zone DEFAULT NOW())
RETURNS integer 
LANGUAGE plpgsql AS $$
DECLARE
	__net numeric := 0; __nets numeric[] := ARRAY[]::integer[];
	__question_count integer; __category record;
	__publisher_id integer; __category_id integer; __name text;
	__a integer; __b numeric; __error boolean := false;
	__full_name text;
BEGIN
	SELECT __details[1]::integer, __details[2]::integer, __details[3] FROM regexp_matches(_details, '(\d+):(\d+)(?:\ ([\S\s]+))?') AS __details INTO __publisher_id, __category_id, __name;
	SELECT * INTO __category FROM exams.categories WHERE exams.categories.id = __category_id;
	IF __category IS null OR NOT EXISTS (SELECT 1 FROM publishers WHERE publishers.id = __publisher_id) OR _duration::interval > '1 day'::interval  THEN RETURN 0;
	ELSE
		FOR __a IN 1..array_length(__category.schema, 1) LOOP
			__question_count := (CASE WHEN _nets[__a][3] IS null THEN __category.schema[__a][2] ELSE _nets[__a][3] END);
			IF _nets[__a][1] IS null OR _nets[__a][2] IS null OR (__question_count < _nets[__a][1] + _nets[__a][2]) THEN __error := true; EXIT; END IF;
			__b := (__question_count - _nets[__a][1] - _nets[__a][2])::numeric - (_nets[__a][1]::numeric / 4.00);
			__net = __net + __b; __nets := __nets || ARRAY[[__b, __question_count, _nets[__a][1], _nets[__a][2]]];
		END LOOP;
		IF __error THEN
			RETURN 0;
		ELSE
			__full_name := (SELECT publishers.name FROM publishers WHERE publishers.id = __publisher_id) || ' ' || (SELECT exams.categories.name FROM exams.categories WHERE exams.categories.id = __category_id) || ' ' || __name;
			INSERT INTO exams (publisher_id, category_id, user_id, net, duration, timestamp, nets, name, full_name) VALUES (__publisher_id, __category_id, _user_id, __net, _duration::interval, _timestamp, __nets, __name, __full_name) RETURNING id INTO __a;
			RETURN __a;
		END IF;
	END IF;
END $$;



-- DROP FUNCTION IF EXISTS exams.categories_get;
CREATE OR REPLACE FUNCTION exams.categories_get(_id integer)
RETURNS TABLE (id integer, name text, question_count integer, schema integer[]) 
LANGUAGE plpgsql AS $$
BEGIN
	RETURN QUERY SELECT exams.categories.id, exams.categories.name, exams.categories.question_count, exams.categories.schema FROM exams.categories WHERE exams.categories.id = _id;
END $$;



-- DROP FUNCTION IF EXISTS exams.categories_search;
CREATE OR REPLACE FUNCTION exams.categories_search(_text text, _filter text[], _before numeric DEFAULT 'Infinity'::numeric)
RETURNS TABLE (ids integer[], count bigint) 
LANGUAGE plpgsql AS $$
BEGIN
	RETURN QUERY SELECT ARRAY((SELECT exams.categories.id FROM exams.categories WHERE exams.categories.id < _before ORDER BY similarity(_text, exams.categories.name) DESC LIMIT 10)), 0::bigint;
END $$;



/*
exams.categories_new(name, [[lesson_1, count_1], [lesson_2, count_2], ...])
RETURNS <positive_integer> IF succesfully completed
RETURNS 0 IF error
*/ 
-- DROP FUNCTION IF EXISTS exams.categories_new;
CREATE OR REPLACE FUNCTION exams.categories_new(_name text, _schema integer[])
RETURNS integer 
LANGUAGE plpgsql AS $$
DECLARE
	__question_count integer := 0; __a integer;
	__error boolean := false;
BEGIN
	FOR __a IN 1..array_length(_schema, 1) LOOP 
		IF _schema[__a][2] IS null OR NOT EXISTS(SELECT 1 FROM lessons WHERE lessons.id = _schema[__a][1]) THEN __error := true; EXIT; END IF;
		__question_count = __question_count + _schema[__a][2]; 
	END LOOP;
	IF __error THEN
		RETURN 0;
	ELSE 
		INSERT INTO exams.categories (name, question_count, schema) VALUES (_name, __question_count, _schema) RETURNING id INTO __a;
		RETURN __a;
	END IF;
END $$;
