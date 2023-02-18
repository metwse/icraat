-- DROP FUNCTION IF EXISTS publishers.get;
CREATE OR REPLACE FUNCTION publishers.get(_id integer)
RETURNS TABLE (id integer, name text) 
LANGUAGE plpgsql AS $$
BEGIN
	RETURN QUERY SELECT publishers.id, publishers.name FROM publishers WHERE publishers.id = _id;
END $$;



-- DROP FUNCTION IF EXISTS publishers.search;
CREATE OR REPLACE FUNCTION publishers.search(_text text, _filter text[], _before numeric DEFAULT 'Infinity'::numeric)
RETURNS TABLE (ids integer[], count bigint) 
LANGUAGE plpgsql AS $$
BEGIN
	RETURN QUERY SELECT ARRAY((SELECT publishers.id FROM publishers WHERE publishers.id < _before ORDER BY similarity(_text, publishers.name) DESC LIMIT 10)), 0::bigint;
END $$;