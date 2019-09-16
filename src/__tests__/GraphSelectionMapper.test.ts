import { GraphSelectionMapper } from '../';

test('sanitizeFieldMap properly sanitizes field map.', () => {
    const fieldMap = [
        'store',
        'store.name',
        'store.location.streetName',
        'store.id',
        'store.id',
        'store.location.city',
    ];
    const sanitizedFieldMap = GraphSelectionMapper.sanitizeFieldMap(fieldMap);
    let duplicates = 0;
    sanitizedFieldMap.forEach(field => {
        if (field == 'store.id') {
            duplicates++;
        }
    });
    if (duplicates > 1) {
        fail('Duplicated were not removed.');
    }
    if (sanitizedFieldMap.indexOf('store.location.streetName') === -1) {
        fail('Properties were removed incorrectly.');
    }
    if (sanitizedFieldMap.indexOf('store.location.city') === -1) {
        fail('Properties with similar paths were removed.');
    }
    if (sanitizedFieldMap.indexOf('store.name') === -1) {
        fail('Base properties were removed.');
    }
    if (sanitizedFieldMap.indexOf('store') !== -1) {
        fail('Relations without selections were not removed.');
    }
});

test('getRelationMap properly builds relation map.', () => {
    const fieldMap = ['store.name', 'store.location.streetName', 'store.id', 'store.location.city'];
    const relationMap = GraphSelectionMapper.getRelationMap(fieldMap);
    if (relationMap.indexOf('store') === -1 || relationMap.indexOf('store.location') === -1) {
        fail('Relation paths were removed, or were not propagated.');
    }
    if (relationMap.indexOf('store.location.streetName') !== -1 || relationMap.indexOf('store.id') !== -1) {
        fail('Property paths should have been removed but instead were maintained.');
    }
    let duplicates = 0;
    relationMap.forEach(field => {
        if (field == 'store.location') {
            duplicates++;
        }
    });
    if (duplicates > 1) {
        fail('Relation map contained duplicate relation entry.');
    }
});

test('generateUniqueRelationMap properly hydrates structure', () => {
    const fieldMap = ['store.name', 'store.location.streetName', 'store.id', 'store.location.city'];
    const urm = GraphSelectionMapper.getUniqueRelationMap(fieldMap);
    if (Object.keys(urm).length !== 2) {
        fail('Returned object is of an incorrect length.');
    }
    if (urm['store.location'] == null) {
        fail('Returned object does not have proper navigational keys.');
    }
    if (urm['store.location'].targetRelation !== 'store.location') {
        fail('Object structure is miss-aligned. Target relation is not equal to originating location.');
    }
});
