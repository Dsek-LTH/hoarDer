import { ApolloServer } from "apollo-server";
import { GraphQLObjectType, GraphQLString } from "graphql";
import { v1 as neo4j } from "neo4j-driver";
import { makeAugmentedSchema } from "neo4j-graphql-js";

const typeDefs = `
interface UnitType {
    name: String!
    barcode: Identifier
}
interface Unit {
    container: Container
}

enum BarcodeType {
    QR
    EAN
}

type Container implements Unit & UnitType {
    name: String!
    barcode: Identifier @relation(name: "HAS_BARCODE", direction: "OUT")
    container: Container @relation(name: "POSITION", direction: "OUT")
    containsItems: [Unit!] @relation(name: "POSITION", direction: "IN")
    containsStacks: [ProductStack!]
}
type Item implements Unit & UnitType {
    name: String!
    barcode: Identifier @relation(name: "HAS_BARCODE", direction: "OUT")
    container: Container @relation(name: "POSITION", direction: "OUT")
}
type ProductStack @relation(name: "CONTAINS_STACK") {
    amount: Int!
    to: Container!
    from: ProductType!
}
type ProductType implements UnitType {
    name: String!
    barcode: Identifier @relation(name: "HAS_BARCODE", direction: "OUT")
    stacks: [ProductStack!]
}
type Identifier {
    code: String!
    barcodeType: BarcodeType!
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
