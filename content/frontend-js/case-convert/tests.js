test.public('camelToSnake: simple words', () => {
  expect(camelToSnake('userId')).toBe('user_id');
  expect(camelToSnake('createdAtTime')).toBe('created_at_time');
});

test.public('snakeToCamel: simple words', () => {
  expect(snakeToCamel('user_id')).toBe('userId');
  expect(snakeToCamel('created_at_time')).toBe('createdAtTime');
});

test('camelToSnake: acronyms', () => {
  expect(camelToSnake('getHTTPResponse')).toBe('get_http_response');
  expect(camelToSnake('userID')).toBe('user_id');
  expect(camelToSnake('HTTPServer')).toBe('http_server');
  expect(camelToSnake('parseXMLToJSON')).toBe('parse_xml_to_json');
});

test('camelToSnake: digits', () => {
  expect(camelToSnake('version2Beta')).toBe('version2_beta');
  expect(camelToSnake('h1Title')).toBe('h1_title');
});

test('camelToSnake: nothing to split', () => {
  expect(camelToSnake('already')).toBe('already');
  expect(camelToSnake('snake_case')).toBe('snake_case');
  expect(camelToSnake('')).toBe('');
});

test('snakeToCamel: repeated underscores between words', () => {
  expect(snakeToCamel('a__b')).toBe('aB');
});

test('snakeToCamel: one-letter words', () => {
  expect(snakeToCamel('is_a_test')).toBe('isATest');
  expect(snakeToCamel('a_b_c')).toBe('aBC');
});

test('snakeToCamel: leading and trailing underscores stay', () => {
  expect(snakeToCamel('__private_value')).toBe('__privateValue');
  expect(snakeToCamel('_id')).toBe('_id');
  expect(snakeToCamel('trailing_')).toBe('trailing_');
});

test('snakeToCamel: digits', () => {
  expect(snakeToCamel('version2_beta')).toBe('version2Beta');
  expect(snakeToCamel('page_2')).toBe('page2');
});

test('round trip of simple names', () => {
  for (const name of ['userId', 'createdAt', 'pageSize', 'x'])
    expect(snakeToCamel(camelToSnake(name))).toBe(name);
});
