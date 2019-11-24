# typeorm-graph-select
A lightweight layer between GraphQL & TypeORM to enable more flexible efficient queries powered by GraphQL. 

### Table of Contents

* [Motivation](#Motivation)  
* [What It Does](#what-it-does)  
* [What It Does Not](#what-it-does-nott)  
* [How It Works](#how-it-works)  
  * [Naming Conventions](#naming-conventions)  
  * [Assigning a Selection](#assigning-a-selection)  
* [Contributing](#contributing) 

### Motivation

When using TypeORM along side GraphQL for personal projects, I found myself needing a way dynamically query data based on GraphQL requests. The answer was typeorm-graph-select. 

With typeorm-graph-select I can quickly pass my GraphQL selection and select query to `mapGraph` and have the GraphQL selection applied to my TypeORM query.

### What It Does

* Maps GraphQL selections to TypeORM Queries.
* Joins nested types automatically.
* Supports joining the same nested type more than once.
* Selects only the fields requested.*

\*Currently there are some caveats with nested selections.

### What It Does Not

* Execute queries.
* Handle mutations.

### How It Works

#### Naming Conventions

At the heart of typeorm-graph-select, it uses naming conventions to attempt to map the requested selection. If you have a GraphQL schema that does not match the properties or relations of your TypeORM entities, then this library may not be for you.

#### Assigning a Selection

typeorm-graph-select simply applies a selection to a pre-existing TypeORM query. In order to assign a selection, we first need two things, a `fieldMap` and a `SelectQueryBuilder`. 

A `fieldMap` can be generated from `GraphQLResolveInfo` using libraries like `graphql-fields-list`. As the generation of this field map is outside the scope of this doc, I will simply provide an example of one below.

\*Currently I am working on adding additional functionality to this library to assist with automating this process.

```javascript
var fieldMap = [
    'users',
    'users.roles',
    'users.roles.actions',
    'name',
];
```

Now all we need to do is initialize a `SelectQueryBuilder` and pass our `fieldMap` to typeorm-graph-select.

```javascript
// Create a SelectQueryBuilder<Organization>
const queryBuilder = await getConnection().createQueryBuilder(Organization);

// Apply a selection to the query.
let uniqueRelationalMap = mapGraph(fieldMap, queryBuilder, Organization);

// Execute the query.
const organization = queryBuilder.where("id = :id", {id: 1}).getOne();
```

In the above example, `organization` will have the requested nested relations hydrated, as well as the requested fields.

It is worth noting the uniqueRelationalMap that is returned by mapGraph, as this will contain all relational mapping information used within the query selection. This can be useful for tracking or debugging. 

### Contributing

All contributions are welcome, however I would ask that any and all pull requests have a corresponding issue first, just so we can figure out any details prior to work being performed.
