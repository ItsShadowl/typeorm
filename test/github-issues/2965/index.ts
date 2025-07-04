import "reflect-metadata"
import { DataSource } from "../../../src"
import "../../utils/test-setup"
import {
    closeTestingConnections,
    createTestingConnections,
    reloadTestingDatabases,
} from "../../utils/test-utils"
import { Note } from "./entity/note"
import { Person } from "./entity/person"

describe("github issues > #2965 Reuse preloaded lazy relations", () => {
    let connections: DataSource[]
    before(
        async () =>
            (connections = await createTestingConnections({
                entities: [__dirname + "/entity/*{.js,.ts}"],
            })),
    )
    beforeEach(() => reloadTestingDatabases(connections))
    after(() => closeTestingConnections(connections))

    it("should resuse preloaded lazy relations", () =>
        Promise.all(
            connections.map(async (connection) => {
                const repoPerson = connection.getRepository(Person)
                const repoNote = connection.getRepository(Note)

                const personA = repoPerson.create({ name: "personA" })
                const personB = repoPerson.create({ name: "personB" })

                await repoPerson.save([personA, personB])

                await repoNote.insert({ label: "note1", owner: personA })
                await repoNote.insert({ label: "note2", owner: personB })

                const res1 = await repoPerson.find({
                    relations: { notes: true },
                })

                const originalLoad: (...args: any[]) => Promise<any[]> =
                    connection.relationLoader.load
                let loadCalledCounter = 0
                connection.relationLoader.load = (
                    ...args: any[]
                ): Promise<any[]> => {
                    loadCalledCounter++
                    return originalLoad.call(connection.relationLoader, ...args)
                }

                const personANotes = await res1[0].notes
                loadCalledCounter.should.be.equal(0)
                personANotes[0].label.should.be.equal("note1")

                const res2 = await repoPerson.find({ order: { id: "asc" } })
                const personBNotes = await res2[1].notes
                loadCalledCounter.should.be.equal(1)
                personBNotes[0].label.should.be.equal("note2")
            }),
        ))
})
