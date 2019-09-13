import { ApolloServer } from "apollo-server";
import { GraphQLObjectType, GraphQLString } from "graphql";
import { v1 as neo4j } from "neo4j-driver";
import { makeAugmentedSchema } from "neo4j-graphql-js";

const typeDefs = `
type Movie {
    title: String
    year: Int
    imdbRating: Float
    genres: [Genre] @relation(name: "IN_GENRE", direction: "OUT")
}
type Genre {
        name: String
        movies: [Movie] @relation(name: "IN_GENRE", direction: "IN")
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
