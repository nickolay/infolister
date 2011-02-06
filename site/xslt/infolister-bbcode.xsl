<?xml version="1.0" encoding="UTF-8"?>

<!--
 XSLT: InfoLister output XML -> text
 Copyright (c) 2004-2005, Nickolay Ponomarev <asqueella at gmail dot com>
 
 Feel free to use and modify this file to better suit your needs.
 Please contact me if you think your improvements may be useful to others. 
-->

<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns="http://www.w3.org/1999/xhtml">

<xsl:output method="text" encoding="UTF-8" />

<xsl:template match="/info">My <xsl:value-of select="@app"/> information
<xsl:apply-templates /></xsl:template>

<xsl:template match="lastupd">Last updated: <xsl:value-of select="."/></xsl:template>

<xsl:template match="useragent">User Agent: <xsl:value-of select="."/></xsl:template>

<xsl:template match="extensions"> <!-- xxx onelist -->
[b]Extensions[/b] (enabled: <xsl:value-of select="count(ext[@disabled!=true()])"/>, disabled: <xsl:value-of select="count(ext[@disabled])"/>):
[list]<xsl:for-each select="ext"><xsl:apply-templates select="."/></xsl:for-each>[/list]
</xsl:template>

<xsl:template match="themes">
[b]Themes[/b] (<xsl:value-of select="count(theme)"/>):
[list]<xsl:for-each select="theme"><xsl:apply-templates select="."/></xsl:for-each>[/list]
</xsl:template>

<xsl:template match="plugins">
[b]Plugins[/b] (<xsl:value-of select="count(plugin)"/>):
[list]<xsl:for-each select="plugin"><xsl:apply-templates select="."/></xsl:for-each>[/list]
</xsl:template>

<xsl:template match="ext|theme|plugin">
[*]<xsl:choose>
 <xsl:when test="@homepageURL!=''">
  <xsl:attribute name="href"><xsl:value-of select="@homepageURL"/></xsl:attribute>
  <xsl:value-of select="text()"/>
 </xsl:when>
 <xsl:otherwise>
  <xsl:value-of select="text()"/>
 </xsl:otherwise>
</xsl:choose>
<xsl:text> </xsl:text><xsl:value-of select="@version"/>
<xsl:if test="@creator"><xsl:text> by </xsl:text><xsl:value-of select="@creator"/></xsl:if>
<xsl:if test="@description">- <xsl:value-of select="@description"/></xsl:if>
<xsl:if test="@disabled"><xsl:text> [disabled]</xsl:text></xsl:if>
<xsl:if test="@selected"><xsl:text> [selected]</xsl:text></xsl:if>
</xsl:template>

</xsl:stylesheet>
