"""Pos-processa a legenda gerada por ASR antes de virar arquivo do site.

Duas coisas que o reconhecedor erra e que nao podem ir para o ar numa peca
de propaganda eleitoral, onde a legenda e fala ATRIBUIDA a pessoa nominada:

1. Alucinacao no silencio final. O Whisper inventa texto depois do fim da
   fala. Duas assinaturas, e as duas aparecem no depoimento-2:
     a) cue que comeca DEPOIS da duracao real do MP4 (tres "Obrigado."
        entre 46s e 49s num video de 46,3s);
     b) cue de duracao ~zero repetindo texto anterior (46.140 --> 46.140).
   Nenhuma fala humana entrega texto legivel em menos de um terco de
   segundo, entao as duas caem por regra, sem depender de casar o texto.

2. Homofono obvio. "o Professor ali a competencia" e "o Professor alia
   competencia": mesma pronuncia, e so uma das duas e portugues. Corrigido
   porque a leitura certa e inequivoca pela gramatica, nao por adivinhacao
   do que a pessoa disse.

O resto do texto NAO e tocado: quem confere fala de terceiro e gente que
assistiu ao video.
"""
import re
import struct
import sys
from pathlib import Path


def duracao_mp4(caminho):
    """Le a duracao do atom mvhd. Evita depender do ffprobe."""
    dados = Path(caminho).read_bytes()[:200_000]
    i = dados.find(b'mvhd')
    if i < 0:
        return None
    versao = dados[i + 4]
    if versao == 0:
        escala, dur = struct.unpack('>II', dados[i + 16:i + 24])
    else:
        escala, dur = struct.unpack('>IQ', dados[i + 24:i + 36])
    return dur / escala


def segundos(marca):
    """'01:09.360' ou '00:01:09.360' -> float."""
    partes = marca.split(':')
    total = 0.0
    for p in partes:
        total = total * 60 + float(p)
    return total


# Abaixo disto nao ha fala: e artefato do reconhecedor.
DURACAO_MINIMA = 0.35

# Mesma largura que o whisper usou (--max_line_width 42). Uma correcao que
# junta duas linhas numa so estoura a caixa da legenda, entao o texto e
# reembrulhado depois de corrigido.
LARGURA = 42


def reembrulhar(texto):
    palavras = texto.replace('\n', ' ').split()
    linhas, atual = [], ''
    for w in palavras:
        if atual and len(atual) + 1 + len(w) > LARGURA:
            linhas.append(atual)
            atual = w
        else:
            atual = f'{atual} {w}'.strip()
    if atual:
        linhas.append(atual)
    return '\n'.join(linhas)

CORRECOES = [
    # (regex, substituicao, motivo)
    (r'\bProfessor ali\s+a competência\b', 'Professor alia competência,',
     'homofono: "ali a" -> "alia"'),
]


def limpar(vtt_path, mp4_path):
    limite = duracao_mp4(mp4_path)
    texto = Path(vtt_path).read_text(encoding='utf-8')
    blocos = texto.split('\n\n')
    cabecalho, corpo = blocos[0], blocos[1:]

    mantidos, cortados = [], []
    for b in corpo:
        if not b.strip():
            continue
        m = re.search(r'([\d:.]+)\s*-->\s*([\d:.]+)', b)
        if m:
            ini, fim = segundos(m.group(1)), segundos(m.group(2))
            if limite and ini >= limite:
                cortados.append(f'[apos o fim do video] ' + b.strip().replace('\n', ' '))
                continue
            if fim - ini < DURACAO_MINIMA:
                cortados.append(f'[duracao {fim - ini:.2f}s] ' + b.strip().replace('\n', ' '))
                continue
        mantidos.append(b.strip())

    aplicadas = []
    finais = []
    for b in mantidos:
        linhas = b.split('\n')
        tempo, corpo_txt = linhas[0], '\n'.join(linhas[1:])
        for padrao, troca, motivo in CORRECOES:
            corpo_txt, n = re.subn(padrao, troca, corpo_txt)
            if n:
                aplicadas.append(f'{motivo} ({n}x)')
                corpo_txt = reembrulhar(corpo_txt)
        finais.append(tempo + '\n' + corpo_txt)
    saida = cabecalho + '\n\n' + '\n\n'.join(finais) + '\n'

    Path(vtt_path).write_text(saida, encoding='utf-8')
    return limite, cortados, aplicadas, len(mantidos)


def demo():
    """Autoteste: cue depois do fim cai, cue antes fica, homofono corrige."""
    amostra = ('WEBVTT\n\n'
               '00:00.000 --> 00:02.000\no Professor ali a competência\n\n'
               '00:40.000 --> 00:42.000\ndentro do video\n\n'
               '00:50.000 --> 00:52.000\nalucinação depois do fim\n\n'
               '00:44.000 --> 00:44.000\nalucinação de duração zero\n')
    tmp = Path('/tmp/_demo.vtt')
    tmp.write_text(amostra, encoding='utf-8')
    # finge um mp4 de 46,3s sem precisar de arquivo
    global duracao_mp4
    real = duracao_mp4
    duracao_mp4 = lambda _: 46.3
    _, cortados, aplicadas, n = limpar(tmp, 'inexistente.mp4')
    duracao_mp4 = real
    saida = tmp.read_text(encoding='utf-8')
    assert len(cortados) == 2, cortados
    assert 'alucinação' not in saida
    assert 'dentro do video' in saida
    assert 'alia competência,' in saida
    assert max(len(l) for l in saida.split('\n')) <= LARGURA, 'linha estourou a largura'
    assert n == 2
    tmp.unlink()
    print('demo ok: alucinação cortada, cue válida mantida, homófono corrigido')


if __name__ == '__main__':
    if sys.argv[1:] == ['--demo']:
        demo()
    else:
        for vtt, mp4 in zip(sys.argv[1::2], sys.argv[2::2]):
            lim, cortados, aplicadas, n = limpar(vtt, mp4)
            nome = Path(vtt).name
            print(f'{nome}: {n} legendas, vídeo tem {lim:.1f}s')
            for c in cortados:
                print(f'  CORTADO (depois do fim): {c}')
            for a in aplicadas:
                print(f'  CORRIGIDO: {a}')
