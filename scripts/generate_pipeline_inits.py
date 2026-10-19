import os

pipelines = [
    'preprocessing',
    'classification',
    'sentiment',
    'emotion',
    'urgency',
    'embeddings',
    'retrieval',
    'rag'
]

for p in pipelines:
    path = os.path.join('services', 'nlp', 'app', 'pipelines', p, '__init__.py')
    content = f'''"""
{p.capitalize()} pipeline module for Complaint Intelligence.

Phase 0: Architectural boundary defined.
Pipeline implementation scheduled for subsequent phases.
"""

__all__ = []
'''
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Pipeline init files generated successfully.")
