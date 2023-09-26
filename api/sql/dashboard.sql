-- DROP FUNCTION IF EXISTS exams.get_dashboard;
CREATE OR REPLACE FUNCTION exams.get_dashboard()
RETURNS TABLE (exams integer[], publishers integer[], lessons integer[], "exams.categories" integer[]) 
LANGUAGE plpgsql AS $$
DECLARE
	__exams integer[] := ARRAY[]::integer[]; __exams_categories integer[] := ARRAY[]::integer[];
	__publishers integer[] := ARRAY[]::integer[];
	__lessons integer[] := ARRAY[]::integer[];
	__exam integer; __publisher integer; __category integer; __lesson integer;
BEGIN
	FOR __exam, __publisher, __category IN SELECT exams.id, exams.publisher_id, exams.category_id FROM exams GROUP BY exams.publisher_id, exams.category_id, exams.id ORDER BY exams.id DESC LIMIT 30 LOOP
		IF NOT __exam = ANY(__exams) THEN __exams := array_append(__exams, __exam); END IF; 
		IF NOT __publisher = ANY(__publishers) THEN __publishers := array_append(__publishers, __publisher); END IF; 
		IF NOT __category = ANY(__exams_categories) THEN __exams_categories := array_append(__exams_categories, __category); END IF; 
	END LOOP;
	
	FOREACH __category IN ARRAY __exams_categories LOOP
		FOREACH __lesson IN ARRAY (SELECT exams.categories.schema[1:][1] FROM exams.categories WHERE exams.categories.id = __category) LOOP
			IF NOT __lesson = ANY(__lessons) THEN __lessons := array_append(__lessons, __lesson); END IF; 
		END LOOP;
	END LOOP;
	
	RETURN QUERY SELECT __exams, __publishers, __lessons, __exams_categories;
END $$;



-- DROP FUNCTION IF EXISTS exams.get_filters;
CREATE OR REPLACE FUNCTION exams.get_filters()
RETURNS TABLE (publishers integer[], lessons integer[], "exams.categories" integer[], users integer[]) 
LANGUAGE plpgsql AS $$
DECLARE
	__exams_categories integer[] := ARRAY[]::integer[];
	__publishers integer[] := ARRAY[]::integer[];
	__lessons integer[] := ARRAY[]::integer[];
	__users integer[] := ARRAY[]::integer[];
	__publisher integer; __category integer; __lesson integer; __user integer;
BEGIN
	__publishers := ARRAY(SELECT publishers.id FROM publishers GROUP BY publishers.id ORDER BY publishers.id DESC LIMIT 30);
	__users := ARRAY(SELECT users.id FROM users GROUP BY users.id ORDER BY users.id DESC LIMIT 30);
	__exams_categories := ARRAY(SELECT exams.categories.id FROM exams.categories GROUP BY exams.categories.id ORDER BY exams.categories.id DESC LIMIT 30);
	
	FOREACH __category IN ARRAY __exams_categories LOOP
		FOREACH __lesson IN ARRAY (SELECT exams.categories.schema[1:][1] FROM exams.categories WHERE exams.categories.id = __category) LOOP
			IF NOT __lesson = ANY(__lessons) THEN __lessons := array_append(__lessons, __lesson); END IF; 
		END LOOP;
	END LOOP;
	
	RETURN QUERY SELECT __publishers, __lessons, __exams_categories, __users;
END $$;



-- DROP FUNCTION IF EXISTS questions.get_dashboard;
CREATE OR REPLACE FUNCTION questions.get_dashboard()
RETURNS TABLE(days_before integer, questions integer[])
LANGUAGE plpgsql AS $$
BEGIN
	RETURN QUERY SELECT series, questions.get_interval(CURRENT_DATE - make_interval(0, 0, 0, series), CURRENT_DATE -  make_interval(0, 0, 0, series - 1)) FROM generate_series(0,6,1) AS series;
END $$;
