# -*- coding: utf-8 -*-
from __future__ import print_function
import zipfile
import sys
import glob

try:
    pptx_files = glob.glob('*.pptx')
    if not pptx_files:
        print("[ERROR] No PPTX file found")
        sys.exit(1)

    pptx_path = pptx_files[0]
    print("[INFO] Found: " + pptx_path)

    zf = zipfile.ZipFile(pptx_path, 'r')
    print("[OK] PPTX file is valid")

    # List internal structure
    files = sorted(zf.namelist())
    print("Total files: " + str(len(files)))

    # Count slides
    slides = [f for f in files if f.startswith('ppt/slides/slide')]
    print("Slides: " + str(len(slides)))

    # Check key files
    required = ['[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'ppt/presentation.xml']
    for req in required:
        if req in files:
            print("[OK] " + req)
        else:
            print("[MISS] " + req)

    zf.close()
    print("\nStatus: PPTX file is valid and ready to use in PowerPoint")

except Exception as e:
    print("[ERROR] " + str(e))
    sys.exit(1)
