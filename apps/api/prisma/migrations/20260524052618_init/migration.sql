-- CreateTable
CREATE TABLE "Node" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "weight" REAL NOT NULL DEFAULT 0.5,
    "status" TEXT NOT NULL DEFAULT 'active',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "projectId" TEXT,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "embedding" TEXT,
    "embeddingProvider" TEXT
);

-- CreateTable
CREATE TABLE "Edge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'link',
    "strength" REAL NOT NULL DEFAULT 0.5,
    "createdAt" BIGINT NOT NULL,
    CONSTRAINT "Edge_source_fkey" FOREIGN KEY ("source") REFERENCES "Node" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Edge_target_fkey" FOREIGN KEY ("target") REFERENCES "Node" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "YDocSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'atlas:graph:v1',
    "data" BLOB NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Node_projectId_idx" ON "Node"("projectId");

-- CreateIndex
CREATE INDEX "Node_kind_idx" ON "Node"("kind");

-- CreateIndex
CREATE INDEX "Edge_source_idx" ON "Edge"("source");

-- CreateIndex
CREATE INDEX "Edge_target_idx" ON "Edge"("target");
