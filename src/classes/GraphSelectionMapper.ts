import { EntitySchema, SelectQueryBuilder } from 'typeorm';
import { UniqueIdGenerator } from './UniqueIdGenerator';

interface UniqueRelationMap {
    [key: string]: {
        uniqueAlias: string;
        targetRelation: string;
        aliasedTargetRelation: string;
    };
}

export class GraphSelectionMapper {
    /**
     * Removes duplicates and empty relation strings from a field map.
     *
     * I.e.
     * [entity, entity.id, entity.isVendor, entity.isVendor, entity.address, entity.address.id]
     *
     * will become
     *
     * [entity.id, entity.isVendor, entity.address.id]
     *
     *
     * @param fieldMap
     */
    public static sanitizeFieldMap(fieldMap: string[]): string[] {
        let map: string[] = [...fieldMap];
        map.forEach((field, key) => {
            map.forEach((otherField, otherKey) => {
                if (otherKey === key) {
                    return;
                }
                if (otherField.indexOf(field) !== -1) {
                    delete map[key];
                }
            });
        });
        map = map.filter(field => field != null);
        return map;
    }
    /**
     * Receives a field map and returns only relational fields, who's property maps to a entity table.
     * @param fieldMap: string[], [ entity.address.id, entity.id, entity.name, entity.salesOrders.id]
     * @return string[] [entity, entity.address, entity.salesOrders]
     */
    public static getRelationMap(fieldMap: string[]) {
        const map: string[] = [];
        fieldMap
            .filter(field => field.indexOf('.') !== -1)
            .forEach(field => {
                const relation = field.substr(0, field.lastIndexOf('.'));
                if (map.indexOf(relation) === -1) {
                    map.push(relation);
                }
            });
        return map;
    }
    /**
     * Receives a string array of relation mappings (returned from getRelationMap) and returns a unique relation map to
     * be used when querying relations & building selections.
     * @param fieldMap: string[], [entity.address.id, entity.id, entity.name, entity.salesOrders.id]
     * @return UniqueRelationMap, {
     *     [entity.address]{
     *         targetRelation: 'address',
     *         uniqueAlias: 'ax439'
     *     },
     *     [entity.salesOrders]{
     *         targetRelation: 'salesOrders',
     *         uniqueAlias: '43qcO'
     *     },
     *     [entity.salesOrders.salesOrderItems]{
     *         targetRelation: '43qcO.salesOrderItems',
     *         uniqueAlias: 're00o'
     *     }
     * }
     */
    public static getUniqueRelationMap(fieldMap: string[]): UniqueRelationMap {
        const relationMap = GraphSelectionMapper.getRelationMap(fieldMap);
        const urm: UniqueRelationMap = {};
        /**
         * Checks to see if an alias exists for part of a target relation. If so, the target relation
         * returned will have an alias in place of whatever matched pattern was found.
         * @param targetRelation: string, 'entity.salesOrders.salesOrderItems'
         * @return string, '43qcO.salesOrderItems', Aliased target relation.
         */
        const getAliasedTargetRelation = (targetRelation: string): string => {
            let targetRel = '';
            //Ignore root relations (they have no alias prefix).
            if (targetRelation.indexOf('.') === -1) {
                return targetRelation;
            }
            const prefix = targetRelation.substr(0, targetRelation.lastIndexOf('.'));
            Object.keys(urm).forEach((relation): void => {
                if (relation == prefix) {
                    targetRel = targetRelation.replace(prefix, urm[relation].uniqueAlias);
                }
            });
            return targetRel === '' ? targetRelation : targetRel;
        };
        relationMap.forEach(targetRelation => {
            const aliasedTargetRelation = getAliasedTargetRelation(targetRelation);
            const uniqueAlias = UniqueIdGenerator.makeId(5);
            urm[targetRelation] = {
                targetRelation: targetRelation,
                aliasedTargetRelation: aliasedTargetRelation,
                uniqueAlias,
            };
        });
        return urm;
    }
    /**
     * Attempts to join relations to the provided query based on the UniqueRelationMap provided. Target relations
     * that do not exist on the provided entity will throw and error.
     * @param urm UniqueRelationMap
     * @param query SelectQueryBuilder<TEntity>
     * @return void
     */
    protected static joinRelationsToQuery<TEntity>(urm: UniqueRelationMap, query: SelectQueryBuilder<TEntity>): void {
        Object.keys(urm).forEach(relation => {
            if (relation.indexOf('.') === -1) {
                query.leftJoinAndSelect(query.alias + urm[relation].targetRelation, urm[relation].uniqueAlias);
            } else {
                query.leftJoinAndSelect(urm[relation].aliasedTargetRelation, urm[relation].uniqueAlias);
            }
        });
    }
    /**
     * Attempts to assign a selection to the provided query based on the UniqueRelationMap provided. This will remove
     * any existing selection on the provided query!
     * @param fieldMap: string[], [entity.address.id, entity.id, entity.name, entity.salesOrders.id]
     * @param urm UniqueRelationMAp
     * @param query SelectQueryBuilder<TEntity>
     * @return void
     */
    protected static assignSelectionToQuery<TEntity>(
        fieldMap: string[],
        urm: UniqueRelationMap,
        query: SelectQueryBuilder<TEntity>,
    ): void {
        const selection = fieldMap.map(field => {
            let uf = field;
            console.log(field);
            Object.keys(urm).forEach(relation => {
                if (field.indexOf(relation) !== -1) {
                    uf = field.replace(relation, urm[relation].uniqueAlias);
                    console.log(field, uf, relation, urm[relation].uniqueAlias);
                }
            });
            // Properties without a . are root properties and must use the query alias.
            if (uf.indexOf('.') === -1) {
                uf = `${query.alias}.${uf}`;
            }
            return uf;
        });
        query.select(selection);
    }
    /**
     * Attempts to map a graph field map to the provided query, assigning all selections and joining any required
     * relations. This requires that fields in the provided field map fully align with property names in the Entity
     * for the provided query.
     *
     * @param fieldMap: string[], [entity.address.id, entity.id, entity.name, entity.salesOrders.id]
     * @param query SelectQueryBuilder<TEntity>
     * @param entity Function | EntitySchema<any> | string
     * @return UniqueRelationMap
     */
    public static mapGraph<TEntity>(
        fieldMap: string[],
        query: SelectQueryBuilder<TEntity>,
        entity: Function | EntitySchema<any> | string,
    ): UniqueRelationMap {
        // TODO Encapsulate this code into its own method.
        const entityMetadata = query.connection.getMetadata(entity);
        const effectiveFieldMap: string[] = GraphSelectionMapper.sanitizeFieldMap(fieldMap);
        /* fieldMap.forEach((field: string, key: number) => {
            if (field.substr(-2) === '.*') {
                console.log('FOUND ' + field);
                // TODO Encapsulate this code into its own method.
                effectiveFieldMap.splice(key, 1);
                let propertyName = field.replace('.*', '');
                if (propertyName.indexOf('.') !== -1) {
                    propertyName = propertyName.substr(propertyName.lastIndexOf('.') + 1);
                }
                let propertyPath = field.replace('.*', '').replace(`${propertyName}`, '');
                if (propertyPath.indexOf('.') !== -1) {
                    propertyPath = propertyPath.substr(0, propertyPath.lastIndexOf('.'));
                }
                console.log('PROPERTY NAME ' + propertyName);
                console.log('PROPERTY PATH ' + propertyPath);
                entityMetadata.relations.forEach(relation => {
                    console.log(relation.propertyName, propertyName);
                    if (relation.propertyName === propertyName) {
                        relation.inverseEntityMetadata.columns.forEach(column => {
                            effectiveFieldMap.push(`${propertyName}.${column.propertyName}`);
                        });
                    }
                });
            }
        });
        console.log(fieldMap);
        console.log(effectiveFieldMap);*/
        const urm = GraphSelectionMapper.getUniqueRelationMap(effectiveFieldMap);
        console.log(urm);
        GraphSelectionMapper.joinRelationsToQuery(urm, query);
        GraphSelectionMapper.assignSelectionToQuery(effectiveFieldMap, urm, query);
        return urm;
    }
}
