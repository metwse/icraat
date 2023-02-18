-- DROP FUNCTION IF EXISTS books.get;
CREATE OR REPLACE FUNCTION books.get(_id integer)
RETURNS TABLE (id integer, publisher_id integer, name text) 
LANGUAGE plpgsql AS $$
BEGIN
	RETURN QUERY SELECT books.id, books.publisher_id, books.name FROM books WHERE books.id = _id;
END $$;



-- DROP FUNCTION IF EXISTS books.search;
CREATE OR REPLACE FUNCTION books.search(_text text, _filter text[], _before numeric DEFAULT 'Infinity'::numeric)
RETURNS TABLE (ids integer[], count bigint) 
LANGUAGE plpgsql AS $$
BEGIN
	RETURN QUERY SELECT ARRAY((SELECT books.id FROM books WHERE books.id < _before ORDER BY similarity(_text, books.name) DESC LIMIT 10)), 0::bigint;
END $$;
