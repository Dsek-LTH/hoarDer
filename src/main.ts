import { ApolloServer } from "apollo-server";
import { GraphQLObjectType, GraphQLString } from "graphql";
import { v1 as neo4j } from "neo4j-driver";
import { makeAugmentedSchema, neo4jgraphql } from "neo4j-graphql-js";

// First element of each typedef has to be a scalar value, it cannot be an object
// due to makeAugmentedSchema bug!
const typeDefs = `
"""A type of items that can be contained in a container."""
interface UnitType {
    """Unique human friendly identifier"""
    name: String!
    barcode: Identifier
    # Probably want non-null Identifier! in the future and force assigning
    # a barcode on construction, but it requires some manual schema definitions
    # to create custom Mutations instead of the handy auto-generated ones
}

"""An item that can be contained in a container"""
interface Unit {
    container: Container
    """List a unit's container and the container's container and so on,
    with the nearest container first. Limited to 20 containers."""
    # TODO: It would be nice to only have to implement this once,
    # but the current neo4j-graphql-js implementation does not support interface
    # labels and thus implementations
    transitiveContainers: [Container!]!
}

enum IdType {
    QR
    EAN
    USERID
}

"""Singleton type which also is able to contain other items.
Containers can be indefinitely nested and could represent things such as a room,
a shelf, a toolbox, a fridge etc."""
type Container implements Unit & UnitType {
    name: String!
    barcode: Identifier @relation(name: "HAS_BARCODE", direction: "OUT")
    container: Container @relation(name: "POSITION", direction: "OUT")
    containsUnits: [Unit!] @relation(name: "POSITION", direction: "IN")
    containsStacks: [ProductStack!]

    """List a unit's container and the container's container and so on,
    with the nearest container first. Limited to 20 containers."""
    transitiveContainers: [Container!]!
    # Limited to 20 to avoid exploding query if graph is malformed
    @cypher(statement: """
        MATCH p = (this)-[:POSITION*..20]->(c :Container)
        WHERE NOT (c)-[:POSITION]->()
        UNWIND tail(nodes(p)) as n
        RETURN n;
    """)

    """List this container's subcontainers and their subcontainers and so on. Selfincluded."""
    transitiveSubcontainers: [Container!]!
    @cypher(statement: """
        MATCH (this)<-[:POSITION *0..20]-(c :Container)
        RETURN c;
    """)
}

"""Singleton type for tying a specific item to specific barcode and container"""
type Item implements Unit & UnitType {
    name: String!
    barcode: Identifier @relation(name: "HAS_BARCODE", direction: "OUT")
    container: Container @relation(name: "POSITION", direction: "OUT")
    """List a unit's container and the container's container and so on,
    with the nearest container first. Limited to 20 containers."""
    # Limited to 20 to avoid exploding query if graph is malformed
    transitiveContainers: [Container!]!
    @cypher(statement: """
        MATCH p = (this)-[:POSITION*..20]->(c :Container)
        WHERE NOT (c)-[:POSITION]->()
        UNWIND tail(nodes(p)) as n
        RETURN n;
    """)
}

"""Relation that represents a number of a type of item being located in a certain container"""
type ProductStack @relation(name: "CONTAINS_STACK") {
    "How many items the stack contains"
    amount: Int!
    "Where the stack is"
    to: Container!
    "What type of items the stack contains"
    from: ProductType!
}

"""Class of product of which there can be more than one of the same item,
all equivalent and with the same barcode.
The items do not have to be all in the same container at once,
but can be separated into ProductStacks."""
type ProductType implements UnitType {
    name: String!
    barcode: Identifier @relation(name: "HAS_BARCODE", direction: "OUT")
    stacks: [ProductStack!]!
}

"""An identifier that can be of any barcode type, e.g. QR or EAN codes, or StiL"""
type Identifier {
    """The value encoded in the barcode"""
    code: String!
    barcodeType: IdType!
    """The category of items represented by this identifier"""
    unitType: UnitType @relation(name: "HAS_BARCODE", direction: "IN")
}

type Mutation {
    #TODO: supress mutations we do not want accessed
    """The proper way to add a new product type"""
    addProductType(name: String!, barcode: String!, barcodeType: IdType!): ProductType
    @cypher(statement: """
        CREATE (pt: ProductType {name: $name})-[:HAS_BARCODE]->
        (b: Identifier {code: $barcode, barcodeType: $barcodeType})
        RETURN pt""")

    """The proper way to add a new singleton item"""
    addItem(name: String!, barcode: String!, barcodeType: IdType!): Item
    @cypher(statement: """
        CREATE (i: Item {name: $name})-[:HAS_BARCODE]->(b: Identifier {code: $barcode, barcodeType: $barcodeType})
        RETURN i""")

    """Move stack items from one container to another. If the first stack does not
    have $amount of items, the call will fail."""
    moveStackItems(
        "barcode of product type"
        product: String!,
        "barcode of current container"
        from: String!,
        "barcode of container to move items to"
        to: String!,
        "number of product items to move"
        amount: Int!): Boolean!
    @cypher(statement: """
        MATCH (pt: ProductType)-[:HAS_BARCODE]->(prod_code: Identifier {code: $product}),
            (pt)-[from_stack: CONTAINS_STACK]->(:Container)-[:HAS_BARCODE]->(from_code: Identifier {code: $from}),
            (c2: Container)-[:HAS_BARCODE]->(to_code: Identifier {code: $to})
        WHERE from_stack.amount >= $amount
        MERGE (pt)-[to_stack: CONTAINS_STACK]->(c2)
            ON CREATE SET to_stack.amount = $amount
            ON MATCH SET to_stack.amount = coalesce(to_stack.amount, 0) + $amount
        SET from_stack.amount = from_stack.amount - $amount
        RETURN true;
    """)

    """Move singleton item from one container to another.
    If the first container does not contain the item the call will fail."""
    moveItem(
        "barcode of item"
        item: String!,
        "barcode of current container"
        from: String!,
        "barcode of container to move item to"
        to: String!): Boolean!
    @cypher(statement: """
        MATCH (it: Item)-[:HAS_BARCODE]->(:Identifier {code: $item}),
            (it)-[p :POSITION]->(:Container)-[:HAS_BARCODE]->(from_code: Identifier {code: $from}),
            (c2: Container)-[:HAS_BARCODE]->(to_code: Identifier {code: $to})
        DELETE p
        CREATE (it)-[p2 :POSITION]->(c2)
        RETURN true;
    """)
}
`;

const driver = neo4j.driver(
      "bolt://" + process.env.NEO4J_HOST + ":7687",
      neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
);

const schema = makeAugmentedSchema({ typeDefs });

const server = new ApolloServer({ schema, context: { driver }, });

server.listen(8082, "0.0.0.0").then(({ url }) => {
      console.log(`GraphQL API ready at ${url}`);
});
