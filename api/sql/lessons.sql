-- DROP FUNCTION IF EXISTS lessons.get;
CREATE OR REPLACE FUNCTION lessons.get(_id integer)
RETURNS TABLE (id integer, name text) 
LANGUAGE plpgsql AS $$
BEGIN
	RETURN QUERY SELECT lessons.id, lessons.name FROM lessons WHERE lessons.id = _id;
END $$;



-- DROP FUNCTION IF EXISTS lessons.search;
CREATE OR REPLACE FUNCTION lessons.search(_text text, _filter text[], _before numeric DEFAULT 'Infinity'::numeric)
RETURNS TABLE (idS integer[], count bigint) 
LANGUAGE plpgsql AS $$
BEGIN
	RETURN QUERY SELECT ARRAY((SELECT lessons.id FROM lessons WHERE lessons.id < _before ORDER BY similarity(_text, lessons.name) DESC LIMIT 10)), 0::bigint;
END $$;