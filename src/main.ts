import { ApolloServer } from "apollo-server";
import { GraphQLObjectType, GraphQLString } from "graphql";
import { v1 as neo4j } from "neo4j-driver";
import { makeAugmentedSchema } from "neo4j-graphql-js";

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
}

enum BarcodeType {
    QR
    EAN
}

"""Singleton type which also is able to contain other items. Containers can be indefinitely nested and could represent things such as a room, a shelf, a toolbox, a fridge etc."""
type Container implements Unit & UnitType {
    name: String!
    barcode: Identifier @relation(name: "HAS_BARCODE", direction: "OUT")
    container: Container @relation(name: "POSITION", direction: "OUT")
    containsItems: [Unit!] @relation(name: "POSITION", direction: "IN")
    containsStacks: [ProductStack!]
}

"""Singleton type for tying a specific item to specific barcode and container"""
type Item implements Unit & UnitType {
    name: String!
    barcode: Identifier @relation(name: "HAS_BARCODE", direction: "OUT")
    container: Container @relation(name: "POSITION", direction: "OUT")
}
"""Relation that represents a number of a type of item being located in a certain container"""
type ProductStack @relation(name: "CONTAINS_STACK") {
    amount: Int!
    to: Container!
    from: ProductType!
}
"""Class of product of which there can be more than one of the same item, all equivalent and with the same barcode. The items do not have to be all in the same container at once, but can be separated into ProductStacks."""
type ProductType implements UnitType {
    name: String!
    barcode: Identifier @relation(name: "HAS_BARCODE", direction: "OUT")
    stacks: [ProductStack!]
}
"""A barcode that can be of any type, e.g. QR or EAN codes"""
type Identifier {
    """The value encoded in the barcode"""
    code: String!
    barcodeType: BarcodeType!
    """The category of items represented by this barcode"""
    unitType: UnitType @relation(name: "HAS_BARCODE", direction: "IN")
}
`;

const schema = makeAugmentedSchema({ typeDefs });

const driver = neo4j.driver(
      "bolt://" + process.env.NEO4J_HOST + ":7687",
      neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
);

const server = new ApolloServer({ schema, context: { driver } });

server.listen(8082, "0.0.0.0").then(({ url }) => {
      console.log(`GraphQL API ready at ${url}`);
});
