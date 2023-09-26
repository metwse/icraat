-- DROP FUNCTION IF EXISTS users.get;
CREATE OR REPLACE FUNCTION users.get(_id integer)
RETURNS TABLE (id integer, name text) 
LANGUAGE plpgsql AS $$
BEGIN
	RETURN QUERY SELECT users.id, users.name FROM users WHERE users.id = _id;
END $$;



-- DROP FUNCTION IF EXISTS users.search;
CREATE OR REPLACE FUNCTION users.search(_text text, _filter text[], _before numeric DEFAULT 'Infinity'::numeric)
RETURNS TABLE (idS integer[], count bigint) 
LANGUAGE plpgsql AS $$
BEGIN
	RETURN QUERY SELECT ARRAY((SELECT users.id FROM users WHERE users.id < _before ORDER BY similarity(_text, users.name) DESC LIMIT 10)), 0::bigint;
END $$;
