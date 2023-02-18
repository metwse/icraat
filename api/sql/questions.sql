-- DROP FUNCTION IF EXISTS questions.new;
CREATE OR REPLACE FUNCTION questions.new(_book_id int, _count int, _timestamp timestamp with time zone DEFAULT NOW())
RETURNS integer
LANGUAGE plpgsql AS $$
BEGIN
	IF _count > 0 AND EXISTS (SELECT true FROM books WHERE books.id = _book_id) THEN
		INSERT INTO questions (book_id, timestamp, count) VALUES (_book_id, _timestamp, _count);
		RETURN 1;
	ELSE RETURN 0; END IF;
END $$;



-- DROP FUNCTION IF EXISTS questions.get_interval;
CREATE OR REPLACE FUNCTION questions.get_interval(_start timestamp with time zone, _end timestamp with time zone)
RETURNS integer[]
LANGUAGE plpgsql AS $$
BEGIN
	RETURN (SELECT ARRAY_AGG(ARRAY[questions.book_id, questions.count, EXTRACT(epoch FROM questions.timestamp)]) FROM questions WHERE questions.timestamp >= _start AND questions.timestamp < _end);
END $$;
