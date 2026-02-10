-- ============================================================
-- Migration: RAG & Knowledge Graph tables
-- ============================================================

-- Documents (club PDF/markdown uploads)
CREATE TABLE public.documents (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id         uuid NOT NULL REFERENCES public.clubs(id),
  title           text NOT NULL,
  content_type    text DEFAULT 'application/pdf',
  storage_path    text NOT NULL,
  page_count      integer,
  status          text DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_documents_club ON public.documents(club_id);

-- Document Chunks (vector RAG)
CREATE TABLE public.document_chunks (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id     uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  club_id         uuid NOT NULL REFERENCES public.clubs(id),
  chunk_index     integer NOT NULL,
  content         text NOT NULL,
  embedding       vector(2000),
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX idx_chunks_embedding ON public.document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_chunks_document ON public.document_chunks(document_id);
CREATE INDEX idx_chunks_club ON public.document_chunks(club_id);

-- KG Nodes
CREATE TABLE public.kg_nodes (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id         uuid NOT NULL REFERENCES public.clubs(id),
  entity_type     text NOT NULL CHECK (entity_type IN (
    'ATHLETE', 'WORKOUT', 'INJURY', 'EQUIPMENT',
    'CLUB_RULE', 'DOCUMENT_CHUNK', 'EVENT', 'FATIGUE_STATE'
  )),
  entity_id       uuid,
  label           text NOT NULL,
  properties      jsonb DEFAULT '{}'
);

CREATE INDEX idx_kg_nodes_club ON public.kg_nodes(club_id);
CREATE INDEX idx_kg_nodes_entity ON public.kg_nodes(entity_type, entity_id);

-- KG Edges
CREATE TABLE public.kg_edges (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id         uuid NOT NULL REFERENCES public.clubs(id),
  source_node_id  uuid NOT NULL REFERENCES public.kg_nodes(id) ON DELETE CASCADE,
  target_node_id  uuid NOT NULL REFERENCES public.kg_nodes(id) ON DELETE CASCADE,
  relationship    text NOT NULL CHECK (relationship IN (
    'PERFORMED', 'CAUSED', 'RECOMMENDS', 'RESTRICTS',
    'HAS_INJURY', 'USES_EQUIPMENT', 'LINKED_TO', 'REFERS_TO'
  )),
  weight          real DEFAULT 1.0,
  properties      jsonb DEFAULT '{}'
);

CREATE INDEX idx_kg_edges_source ON public.kg_edges(source_node_id);
CREATE INDEX idx_kg_edges_target ON public.kg_edges(target_node_id);
CREATE INDEX idx_kg_edges_club ON public.kg_edges(club_id);

-- ============================================================
-- Vector similarity search function
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector(2000),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_club_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  WHERE
    (filter_club_id IS NULL OR dc.club_id = filter_club_id)
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================
-- Knowledge graph traversal function
-- ============================================================
CREATE OR REPLACE FUNCTION public.traverse_athlete_graph(
  p_athlete_id uuid,
  p_depth int DEFAULT 3,
  p_relationship_types text[] DEFAULT ARRAY['HAS_INJURY', 'PERFORMED', 'CAUSED']
)
RETURNS TABLE (
  node_id uuid,
  entity_type text,
  label text,
  properties jsonb,
  relationship text,
  depth int
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE graph_walk AS (
    -- Start from athlete node
    SELECT
      n.id AS node_id,
      n.entity_type,
      n.label,
      n.properties,
      ''::text AS relationship,
      0 AS depth
    FROM public.kg_nodes n
    WHERE n.entity_type = 'ATHLETE' AND n.entity_id = p_athlete_id

    UNION ALL

    -- Walk edges
    SELECT
      n2.id,
      n2.entity_type,
      n2.label,
      n2.properties,
      e.relationship,
      gw.depth + 1
    FROM graph_walk gw
    JOIN public.kg_edges e ON e.source_node_id = gw.node_id
    JOIN public.kg_nodes n2 ON n2.id = e.target_node_id
    WHERE
      gw.depth < p_depth
      AND e.relationship = ANY(p_relationship_types)
  )
  SELECT * FROM graph_walk WHERE depth > 0;
END;
$$;
